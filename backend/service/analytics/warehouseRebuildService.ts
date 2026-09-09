import { gunzipSync } from "node:zlib";
import { setTimeout as delayMs } from "node:timers/promises";
import { ulid } from "ulid";
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { FirehoseClient, PutRecordBatchCommand } from "@aws-sdk/client-firehose";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import type { AttributeValue } from "@aws-sdk/client-dynamodb";
import { logInfo, logError } from "../../logger";
import { WarehouseJobRunsDao } from "../../dao/analytics/warehouseJobRunsDao";
import type { WarehouseJobRun, WarehouseJobRunStatus } from "../../models/warehouseJobRun";
import type {
  RebuildSource,
  RebuildChunk,
  RebuildWipeTask,
  RebuildWipeResult,
  RebuildReplayTask,
  RebuildReplayResult,
  RebuildFinalizeTask,
  RebuildFailTask,
  WarehouseRebuildResult,
} from "../../models/warehouseRebuild";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

type ExportItem = Record<string, unknown>;

interface RebuildTarget {
  table: string;
  firehoseEnv: string;
  relevant: (item: ExportItem) => boolean;
}

/*
 * Source (DynamoDB table) → the warehouse tables it feeds, with the same
 * per-row relevance predicate the live fan-out Lambdas apply. `orders`
 * fans to two.
 */
const SOURCE_TARGETS: Record<RebuildSource, RebuildTarget[]> = {
  orders: [
    {
      table: "order_snapshots",
      firehoseEnv: "ORDER_SNAPSHOTS_FIREHOSE_NAME",
      relevant: (item) => item["sk"] === "#METADATA",
    },
    {
      table: "order_events",
      firehoseEnv: "ORDER_EVENTS_FIREHOSE_NAME",
      relevant: (item) => typeof item["sk"] === "string" && (item["sk"] as string).startsWith("EVENT#"),
    },
  ],
  requests: [
    {
      table: "requests",
      firehoseEnv: "REQUESTS_FIREHOSE_NAME",
      relevant: (item) => typeof item["external_unique_key"] !== "undefined",
    },
  ],
  locations: [
    {
      table: "locations",
      firehoseEnv: "LOCATIONS_FIREHOSE_NAME",
      relevant: (item) => typeof item["location_id"] !== "undefined",
    },
  ],
};

const FIREHOSE_BATCH_SIZE = 500;
const S3_DELETE_BATCH_SIZE = 1000;
/*
 * Rows per replay chunk. ~3k rows ≈ a few MB ≈ ≤6 PutRecordBatch calls —
 * absorbed by the stream's burst allowance with no proactive pacing. The
 * `Map`'s `Wait` between chunks sets the sustained rate.
 */
const CHUNK_ROWS = 3000;
/*
 * Transient-throttle backoff only. The state machine owns rate-limiting —
 * it replays one small line-range chunk per Lambda invocation with a Wait
 * between, so a single PutRecordBatch never approaches the stream limit;
 * this just rides out the occasional ProvisionedThroughputExceeded.
 */
const FIREHOSE_MAX_ATTEMPTS = 8;
const FIREHOSE_BACKOFF_BASE_MS = 400;
const FIREHOSE_BACKOFF_MAX_MS = 20_000;

export interface WarehouseRebuildDeps {
  s3Client?: S3Client;
  firehoseClient?: FirehoseClient;
  jobRunsDao?: WarehouseJobRunsDao;
  bucket?: string;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
}

interface ResolvedDeps {
  s3: S3Client;
  firehose: FirehoseClient;
  bucket: string;
  now: () => Date;
  sleep: (ms: number) => Promise<void>;
  /** Lazily built — the `replay` phase never touches DynamoDB, so it never needs `WAREHOUSE_JOB_RUNS_TABLE_NAME`. */
  jobRunsDao: () => WarehouseJobRunsDao;
}

function resolve(deps: WarehouseRebuildDeps): ResolvedDeps {
  let dao = deps.jobRunsDao;
  return {
    s3: deps.s3Client ?? new S3Client({}),
    firehose: deps.firehoseClient ?? new FirehoseClient({}),
    bucket: deps.bucket ?? requireEnv("WAREHOUSE_BUCKET_NAME"),
    now: deps.now ?? (() => new Date()),
    sleep: deps.sleep ?? ((ms) => delayMs(ms)),
    jobRunsDao: () => {
      dao ??= new WarehouseJobRunsDao(
        DynamoDBDocumentClient.from(new DynamoDBClient({})),
        requireEnv("WAREHOUSE_JOB_RUNS_TABLE_NAME")
      );
      return dao;
    },
  };
}

async function deleteAllUnderPrefix(d: ResolvedDeps, prefix: string): Promise<number> {
  let deleted = 0;
  let continuationToken: string | undefined;
  do {
    const listed = await d.s3.send(
      new ListObjectsV2Command({ Bucket: d.bucket, Prefix: prefix, ContinuationToken: continuationToken })
    );
    const keys = (listed.Contents ?? []).map((o) => o.Key).filter((k): k is string => typeof k === "string");
    for (let i = 0; i < keys.length; i += S3_DELETE_BATCH_SIZE) {
      const chunk = keys.slice(i, i + S3_DELETE_BATCH_SIZE);
      await d.s3.send(
        new DeleteObjectsCommand({ Bucket: d.bucket, Delete: { Objects: chunk.map((Key) => ({ Key })), Quiet: true } })
      );
      deleted += chunk.length;
    }
    continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
  } while (continuationToken);
  logInfo("WarehouseRebuildPrefixWiped", { prefix, deleted });
  return deleted;
}

/** `arn:aws:dynamodb:…:table/Orders-Test/export/01234…` → `export-staging/<source>/AWSDynamoDB/01234…`. */
function exportBaseKey(source: RebuildSource, exportArn: string): string {
  const exportId = exportArn.split("/").pop();
  if (!exportId) throw new Error(`Cannot parse ExportId from ${exportArn}`);
  return `export-staging/${source}/AWSDynamoDB/${exportId}`;
}

async function getObjectText(d: ResolvedDeps, key: string): Promise<string> {
  const response = await d.s3.send(new GetObjectCommand({ Bucket: d.bucket, Key: key }));
  const body = await response.Body?.transformToString();
  if (typeof body !== "string") throw new Error(`Empty object at ${key}`);
  return body;
}

async function getObjectGunzippedLines(d: ResolvedDeps, key: string): Promise<string[]> {
  const response = await d.s3.send(new GetObjectCommand({ Bucket: d.bucket, Key: key }));
  const bytes = await response.Body?.transformToByteArray();
  if (!bytes) throw new Error(`Empty object at ${key}`);
  return gunzipSync(Buffer.from(bytes))
    .toString("utf-8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/** `{ Item: <DynamoDB-JSON> }` per line → plain object. */
function unmarshallLine(line: string): ExportItem {
  const { Item } = JSON.parse(line) as { Item: Record<string, AttributeValue> };
  return unmarshall(Item);
}

async function putRecordsToFirehose(d: ResolvedDeps, streamName: string, records: ExportItem[]): Promise<void> {
  for (let i = 0; i < records.length; i += FIREHOSE_BATCH_SIZE) {
    let pending = records
      .slice(i, i + FIREHOSE_BATCH_SIZE)
      .map((record) => ({ Data: Buffer.from(JSON.stringify(record), "utf-8") }));

    for (let attempt = 1; attempt <= FIREHOSE_MAX_ATTEMPTS && pending.length > 0; attempt++) {
      if (attempt > 1) {
        await d.sleep(Math.min(FIREHOSE_BACKOFF_BASE_MS * 2 ** (attempt - 2), FIREHOSE_BACKOFF_MAX_MS));
      }
      const response = await d.firehose.send(
        new PutRecordBatchCommand({ DeliveryStreamName: streamName, Records: pending })
      );
      if (!response.FailedPutCount) {
        pending = [];
        break;
      }
      const responses = response.RequestResponses ?? [];
      const sampleError = responses.find((r) => r.ErrorCode)?.ErrorCode;
      pending = pending.filter((_, idx) => responses[idx]?.ErrorCode);
      logInfo("WarehouseRebuildFirehoseRetry", { streamName, attempt, retrying: pending.length, sampleError });
    }
    if (pending.length > 0) {
      throw new Error(
        `Firehose PutRecordBatch left ${pending.length} records unwritten for ${streamName} after ${FIREHOSE_MAX_ATTEMPTS} attempts`
      );
    }
  }
}

function jobRow(
  task: { source: RebuildSource; exportArn: string; startedAt: string },
  jobRunId: string,
  status: WarehouseJobRunStatus,
  now: () => Date,
  extra: Partial<WarehouseJobRun> = {}
): WarehouseJobRun {
  return {
    job_run_id: jobRunId,
    job_name: `REBUILD_${task.source.toUpperCase()}`,
    status,
    trigger: "MANUAL",
    started_at: task.startedAt,
    completed_at: status === "RUNNING" ? null : now().toISOString(),
    execution_ref: task.exportArn,
    result_location: null,
    row_count: null,
    error_message: null,
    retry_count: 0,
    retried_from_job_run_id: null,
    data_scanned_bytes: null,
    engine_execution_time_ms: null,
    query_queue_time_ms: null,
    ...extra,
  };
}

/** The export's `manifest-files.json` (JSON-lines) → `{ dataFileS3Key, itemCount }[]`, ordered. */
function parseManifest(manifestText: string): { key: string; itemCount: number }[] {
  return manifestText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const parsed = JSON.parse(line) as { dataFileS3Key: string; itemCount: number };
      return { key: parsed.dataFileS3Key, itemCount: parsed.itemCount };
    });
}

/** Slice each file's line count into `CHUNK_ROWS`-row ranges — the replay `Map`'s work items. */
function chunksFor(files: { key: string; itemCount: number }[]): RebuildChunk[] {
  const chunks: RebuildChunk[] = [];
  for (const file of files) {
    for (let start = 0; start < file.itemCount; start += CHUNK_ROWS) {
      chunks.push({ fileKey: file.key, start, count: Math.min(CHUNK_ROWS, file.itemCount - start) });
    }
  }
  return chunks;
}

/**
 * Phase 1 (`7-data-warehousing.md` §10) — wipe `data/<table>/` for every
 * warehouse table the source feeds, open a `RUNNING` `REBUILD_<SOURCE>`
 * job row, and return that run id plus the export's line-range chunks for
 * the state machine's replay `Map`.
 */
export async function wipeAndListExport(
  task: RebuildWipeTask,
  deps: WarehouseRebuildDeps = {}
): Promise<RebuildWipeResult> {
  const d = resolve(deps);
  logInfo("WarehouseRebuildWipeStarted", { source: task.source, exportArn: task.exportArn });

  for (const target of SOURCE_TARGETS[task.source]) {
    await deleteAllUnderPrefix(d, `data/${target.table}/`);
  }

  const files = parseManifest(
    await getObjectText(d, `${exportBaseKey(task.source, task.exportArn)}/manifest-files.json`)
  );
  const chunks = chunksFor(files);
  if (chunks.length === 0) throw new Error(`Export ${task.exportArn} has no rows to replay`);

  const jobRunId = ulid();
  await d.jobRunsDao().putJobRun(jobRow(task, jobRunId, "RUNNING", d.now));

  logInfo("WarehouseRebuildWipeCompleted", {
    source: task.source,
    jobRunId,
    files: files.length,
    chunks: chunks.length,
    rows: files.reduce((sum, f) => sum + f.itemCount, 0),
  });
  return { job_run_id: jobRunId, chunks };
}

/**
 * Phase 2 — replay one chunk: read its export data file, take the line
 * range `[start, start+count)`, unmarshall each row, keep the ones each
 * target's relevance predicate accepts, stamp `ingestion_source:
 * "REBUILD"` + `warehouse_ingested_at: <exportTime>`, and
 * `firehose:PutRecordBatch` onto the live per-table stream.
 */
export async function replayExportChunk(
  task: RebuildReplayTask,
  deps: WarehouseRebuildDeps = {}
): Promise<RebuildReplayResult> {
  const d = resolve(deps);
  const { chunk } = task;
  const targets = SOURCE_TARGETS[task.source];

  const lines = await getObjectGunzippedLines(d, chunk.fileKey);
  const items = lines.slice(chunk.start, chunk.start + chunk.count).map(unmarshallLine);

  const replayed: RebuildReplayResult = {};
  for (const target of targets) {
    const records = items
      .filter(target.relevant)
      .map((item) => ({ ...item, ingestion_source: "REBUILD", warehouse_ingested_at: task.exportTime }));
    replayed[target.table] = records.length;
    if (records.length > 0) {
      await putRecordsToFirehose(d, requireEnv(target.firehoseEnv), records);
    }
  }

  logInfo("WarehouseRebuildChunkReplayed", {
    source: task.source,
    fileKey: chunk.fileKey,
    start: chunk.start,
    count: chunk.count,
    replayed,
  });
  return replayed;
}

/**
 * Phase 3 — sum the per-file counts, close the job row as `SUCCEEDED`,
 * and drop the consumed export staging.
 */
export async function finalizeRebuild(
  task: RebuildFinalizeTask,
  deps: WarehouseRebuildDeps = {}
): Promise<WarehouseRebuildResult> {
  const d = resolve(deps);

  const total: Record<string, number> = {};
  for (const perFile of task.replayResults) {
    for (const [table, n] of Object.entries(perFile)) total[table] = (total[table] ?? 0) + n;
  }
  const totalReplayed = Object.values(total).reduce((sum, n) => sum + n, 0);

  await d.jobRunsDao().putJobRun(
    jobRow(task, task.jobRunId, "SUCCEEDED", d.now, { row_count: totalReplayed })
  );
  await deleteAllUnderPrefix(d, `export-staging/${task.source}/`);

  logInfo("WarehouseRebuildFinalized", { source: task.source, jobRunId: task.jobRunId, total, totalReplayed });
  return { source: task.source, job_run_id: task.jobRunId, replayed_by_table: total, total_replayed: totalReplayed };
}

/** Catch handler — close the job row as `FAILED` (or open one, if the wipe phase itself failed). */
export async function markRebuildFailed(task: RebuildFailTask, deps: WarehouseRebuildDeps = {}): Promise<void> {
  const d = resolve(deps);
  const jobRunId = task.jobRunId ?? ulid();
  logError("WarehouseRebuildFailed", { source: task.source, jobRunId, error: task.error });
  await d.jobRunsDao().putJobRun(
    jobRow(task, jobRunId, "FAILED", d.now, { error_message: task.error?.slice(0, 1000) ?? "rebuild failed" })
  );
}
