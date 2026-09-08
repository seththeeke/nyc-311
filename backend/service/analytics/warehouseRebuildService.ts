import { gunzipSync } from "node:zlib";
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
import type { WarehouseJobRun } from "../../models/warehouseJobRun";
import type { RebuildSource, WarehouseRebuildResult, WarehouseRebuildTask } from "../../models/warehouseRebuild";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

type ExportItem = Record<string, unknown>;

interface RebuildTarget {
  /** Warehouse Glue/S3 table this branch of the source feeds. */
  table: string;
  /** Env var holding that table's Firehose delivery-stream name. */
  firehoseEnv: string;
  /** Which exported items belong to this warehouse table — mirrors the live fan-out's own relevance check. */
  relevant: (item: ExportItem) => boolean;
}

/*
 * Source (DynamoDB table) → the warehouse tables it feeds, with the same
 * per-row relevance predicate the live fan-out Lambdas apply
 * (`orderEvaluationService.fanOutOrdersStreamRecord`,
 * `nyc311RequestService.fanOutRequestRecord`,
 * `locationEventService.fanOutLocationRecord`). `orders` fans to two.
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

/** Firehose PutRecordBatch hard cap. */
const FIREHOSE_BATCH_SIZE = 500;
/** S3 DeleteObjects hard cap. */
const S3_DELETE_BATCH_SIZE = 1000;

export interface WarehouseRebuildDeps {
  s3Client?: S3Client;
  firehoseClient?: FirehoseClient;
  jobRunsDao?: WarehouseJobRunsDao;
  bucket?: string;
  now?: () => Date;
}

interface ResolvedDeps {
  s3: S3Client;
  firehose: FirehoseClient;
  jobRunsDao: WarehouseJobRunsDao;
  bucket: string;
  now: () => Date;
}

function resolve(deps: WarehouseRebuildDeps): ResolvedDeps {
  return {
    s3: deps.s3Client ?? new S3Client({}),
    firehose: deps.firehoseClient ?? new FirehoseClient({}),
    jobRunsDao:
      deps.jobRunsDao ??
      new WarehouseJobRunsDao(
        DynamoDBDocumentClient.from(new DynamoDBClient({})),
        requireEnv("WAREHOUSE_JOB_RUNS_TABLE_NAME")
      ),
    bucket: deps.bucket ?? requireEnv("WAREHOUSE_BUCKET_NAME"),
    now: deps.now ?? (() => new Date()),
  };
}

/** Deletes every object under `prefix` in the warehouse bucket, paginated + batched. Returns the count deleted. */
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

/** `arn:aws:dynamodb:…:table/Orders-Test/export/01234…` → `AWSDynamoDB/01234…`. */
function exportManifestKey(source: RebuildSource, exportArn: string): string {
  const exportId = exportArn.split("/").pop();
  if (!exportId) throw new Error(`Cannot parse ExportId from ${exportArn}`);
  return `export-staging/${source}/AWSDynamoDB/${exportId}/manifest-files.json`;
}

async function getObjectText(d: ResolvedDeps, key: string): Promise<string> {
  const response = await d.s3.send(new GetObjectCommand({ Bucket: d.bucket, Key: key }));
  const body = await response.Body?.transformToString();
  if (typeof body !== "string") throw new Error(`Empty object at ${key}`);
  return body;
}

async function getObjectGunzippedText(d: ResolvedDeps, key: string): Promise<string> {
  const response = await d.s3.send(new GetObjectCommand({ Bucket: d.bucket, Key: key }));
  const bytes = await response.Body?.transformToByteArray();
  if (!bytes) throw new Error(`Empty object at ${key}`);
  return gunzipSync(Buffer.from(bytes)).toString("utf-8");
}

/** The export's `manifest-files.json` is JSON-lines; each line names one gzipped data file. */
function parseManifestDataFileKeys(manifestText: string): string[] {
  return manifestText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => (JSON.parse(line) as { dataFileS3Key: string }).dataFileS3Key);
}

/** One export data file is JSON-lines of `{ "Item": <DynamoDB-JSON> }`; unmarshall each to a plain object. */
function parseExportDataFile(text: string): ExportItem[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const { Item } = JSON.parse(line) as { Item: Record<string, AttributeValue> };
      return unmarshall(Item);
    });
}

async function putRecordsToFirehose(d: ResolvedDeps, streamName: string, records: ExportItem[]): Promise<void> {
  for (let i = 0; i < records.length; i += FIREHOSE_BATCH_SIZE) {
    const chunk = records.slice(i, i + FIREHOSE_BATCH_SIZE);
    let pending = chunk.map((record) => ({ Data: Buffer.from(JSON.stringify(record), "utf-8") }));
    /* Retry only the records Firehose reports as failed, a few times, before giving up. */
    for (let attempt = 0; attempt < 4 && pending.length > 0; attempt++) {
      const response = await d.firehose.send(
        new PutRecordBatchCommand({ DeliveryStreamName: streamName, Records: pending })
      );
      if (!response.FailedPutCount || response.FailedPutCount === 0) {
        pending = [];
        break;
      }
      const responses = response.RequestResponses ?? [];
      pending = pending.filter((_, idx) => responses[idx]?.ErrorCode);
      logInfo("WarehouseRebuildFirehoseRetry", { streamName, attempt, retrying: pending.length });
    }
    if (pending.length > 0) {
      throw new Error(`Firehose PutRecordBatch left ${pending.length} records unwritten for ${streamName}`);
    }
  }
}

function baseRunRow(task: WarehouseRebuildTask, jobRunId: string, startedAt: string): WarehouseJobRun {
  return {
    job_run_id: jobRunId,
    job_name: `REBUILD_${task.source.toUpperCase()}`,
    status: "RUNNING",
    trigger: "MANUAL",
    started_at: startedAt,
    completed_at: null,
    execution_ref: task.exportArn,
    result_location: null,
    row_count: null,
    error_message: null,
    retry_count: 0,
    retried_from_job_run_id: null,
    data_scanned_bytes: null,
    engine_execution_time_ms: null,
    query_queue_time_ms: null,
  };
}

/**
 * Rebuilds one source's warehoused data from its completed PITR export
 * (`7-data-warehousing.md` §10): wipe `data/<table>/` for each target,
 * then replay every export row — filtered and routed exactly as the live
 * fan-out would, stamped `ingestion_source: "REBUILD"` and
 * `warehouse_ingested_at: <exportTime>` — through the same per-table
 * Firehose. Records a `REBUILD_<SOURCE>` `WarehouseJobRuns` row
 * (`RUNNING` → `SUCCEEDED`/`FAILED`). Re-throws on failure so the Step
 * Functions branch fails too.
 */
export async function rebuildSource(
  task: WarehouseRebuildTask,
  deps: WarehouseRebuildDeps = {}
): Promise<WarehouseRebuildResult> {
  const d = resolve(deps);
  const jobRunId = ulid();
  const startedAt = d.now().toISOString();
  logInfo("WarehouseRebuildStarted", { source: task.source, exportArn: task.exportArn, exportTime: task.exportTime, jobRunId });

  let run = baseRunRow(task, jobRunId, startedAt);
  await d.jobRunsDao.putJobRun(run);

  try {
    const targets = SOURCE_TARGETS[task.source];

    const wipedPrefixes: string[] = [];
    for (const target of targets) {
      const prefix = `data/${target.table}/`;
      await deleteAllUnderPrefix(d, prefix);
      wipedPrefixes.push(prefix);
    }

    const manifestText = await getObjectText(d, exportManifestKey(task.source, task.exportArn));
    const dataFileKeys = parseManifestDataFileKeys(manifestText);
    logInfo("WarehouseRebuildExportListed", { source: task.source, dataFiles: dataFileKeys.length });

    const replayedByTable: Record<string, number> = Object.fromEntries(targets.map((t) => [t.table, 0]));

    for (const key of dataFileKeys) {
      const items = parseExportDataFile(await getObjectGunzippedText(d, key));
      for (const target of targets) {
        const records = items
          .filter(target.relevant)
          .map((item) => ({ ...item, ingestion_source: "REBUILD", warehouse_ingested_at: task.exportTime }));
        if (records.length === 0) continue;
        await putRecordsToFirehose(d, requireEnv(target.firehoseEnv), records);
        replayedByTable[target.table] += records.length;
      }
    }

    const totalReplayed = Object.values(replayedByTable).reduce((sum, n) => sum + n, 0);

    run = {
      ...run,
      status: "SUCCEEDED",
      completed_at: d.now().toISOString(),
      row_count: totalReplayed,
    };
    await d.jobRunsDao.putJobRun(run);
    logInfo("WarehouseRebuildCompleted", { source: task.source, jobRunId, replayedByTable, totalReplayed });

    return {
      source: task.source,
      job_run_id: jobRunId,
      wiped_prefixes: wipedPrefixes,
      replayed_by_table: replayedByTable,
      total_replayed: totalReplayed,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logError("WarehouseRebuildFailed", { source: task.source, jobRunId, error: message });
    run = { ...run, status: "FAILED", completed_at: d.now().toISOString(), error_message: message };
    await d.jobRunsDao.putJobRun(run);
    throw err;
  }
}
