import { gzipSync } from "node:zlib";
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { FirehoseClient, PutRecordBatchCommand } from "@aws-sdk/client-firehose";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  wipeAndListExport,
  replayExportChunk,
  finalizeRebuild,
  markRebuildFailed,
} from "../../../service/analytics/warehouseRebuildService";
import type { WarehouseJobRunsDao } from "../../../dao/analytics/warehouseJobRunsDao";
import type { WarehouseJobRun } from "../../../models/warehouseJobRun";

const s3Mock = mockClient(S3Client);
const s3Client = new S3Client({});
const firehoseMock = mockClient(FirehoseClient);
const firehoseClient = new FirehoseClient({});

const BUCKET = "nyc311-warehouse-test";
const ORDERS_ARN = "arn:aws:dynamodb:us-east-1:111:table/Orders-Test/export/01EXPORTID";
const REQ_ARN = "arn:aws:dynamodb:us-east-1:111:table/Requests-Test/export/01EXPORTID";
const EXPORT_TIME = "2026-09-08T12:00:00.000Z";
const NOW = () => new Date("2026-09-08T13:00:00.000Z");

const FIREHOSE_ENV = {
  ORDER_EVENTS_FIREHOSE_NAME: "Nyc311Warehouse-OrderEvents-Test",
  ORDER_SNAPSHOTS_FIREHOSE_NAME: "Nyc311Warehouse-OrderSnapshots-Test",
  REQUESTS_FIREHOSE_NAME: "Nyc311Warehouse-Requests-Test",
  LOCATIONS_FIREHOSE_NAME: "Nyc311Warehouse-Locations-Test",
} as const;

function daoSpy() {
  const putJobRun = vi.fn<(run: WarehouseJobRun) => Promise<void>>().mockResolvedValue(undefined);
  return { dao: { putJobRun } as unknown as WarehouseJobRunsDao, putJobRun };
}

function gzLines(items: Record<string, unknown>[]): { transformToByteArray: () => Promise<Uint8Array> } {
  const toDdb = (o: Record<string, unknown>): Record<string, unknown> =>
    Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === "number" ? { N: String(v) } : { S: String(v) }]));
  const text = items.map((i) => JSON.stringify({ Item: toDdb(i) })).join("\n");
  const bytes = gzipSync(Buffer.from(text, "utf-8"));
  return { transformToByteArray: async () => new Uint8Array(bytes) };
}

function textBody(text: string): { transformToString: () => Promise<string> } {
  return { transformToString: async () => text };
}

function manifest(files: { key: string; itemCount: number }[]): string {
  return files.map((f) => JSON.stringify({ dataFileS3Key: f.key, itemCount: f.itemCount })).join("\n");
}

function deps(dao: WarehouseJobRunsDao) {
  return { s3Client, firehoseClient, jobRunsDao: dao, bucket: BUCKET, now: NOW, sleep: async () => {} };
}

/** Omits `now`/`sleep` so the service's own default clock/sleep closures actually run. */
function depsNoClock(dao: WarehouseJobRunsDao) {
  return { s3Client, firehoseClient, jobRunsDao: dao, bucket: BUCKET };
}

beforeEach(() => {
  s3Mock.reset();
  firehoseMock.reset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  for (const [k, v] of Object.entries(FIREHOSE_ENV)) process.env[k] = v;
  firehoseMock.on(PutRecordBatchCommand).resolves({ FailedPutCount: 0 });
});

afterEach(() => {
  vi.restoreAllMocks();
  for (const k of Object.keys(FIREHOSE_ENV)) delete process.env[k];
});

describe("wipeAndListExport", () => {
  it("wipes both order targets, opens a RUNNING row, and returns CHUNK_ROWS-sized chunks per file", async () => {
    const { dao, putJobRun } = daoSpy();
    s3Mock.on(ListObjectsV2Command).resolves({ Contents: [{ Key: "data/order_snapshots/dt=x/a.parquet" }], IsTruncated: false });
    s3Mock.on(DeleteObjectsCommand).resolves({});
    s3Mock.on(GetObjectCommand, { Key: "export-staging/orders/AWSDynamoDB/01EXPORTID/manifest-files.json" }).resolves({
      Body: textBody(manifest([{ key: "f1", itemCount: 3000 }, { key: "f2", itemCount: 500 }])),
    } as never);

    const result = await wipeAndListExport(
      { phase: "wipe", source: "orders", exportArn: ORDERS_ARN, startedAt: EXPORT_TIME },
      deps(dao)
    );

    /* 3000 -> one chunk; 500 -> one chunk (CHUNK_ROWS is 3000). */
    expect(result.chunks).toEqual([
      { fileKey: "f1", start: 0, count: 3000 },
      { fileKey: "f2", start: 0, count: 500 },
    ]);
    expect(putJobRun.mock.calls[0][0]).toMatchObject({ job_name: "REBUILD_ORDERS", status: "RUNNING", trigger: "MANUAL" });
    expect(result.job_run_id).toBe(putJobRun.mock.calls[0][0].job_run_id);
    /* two DeleteObjects passes had content -> one per target prefix */
    expect(s3Mock.commandCalls(DeleteObjectsCommand)).toHaveLength(2);
  });

  it("splits a large file into multiple chunks", async () => {
    const { dao } = daoSpy();
    s3Mock.on(ListObjectsV2Command).resolves({ Contents: [], IsTruncated: false });
    s3Mock.on(DeleteObjectsCommand).resolves({});
    s3Mock.on(GetObjectCommand).resolves({ Body: textBody(manifest([{ key: "big", itemCount: 7000 }])) } as never);

    const result = await wipeAndListExport(
      { phase: "wipe", source: "locations", exportArn: ORDERS_ARN, startedAt: EXPORT_TIME },
      deps(dao)
    );
    expect(result.chunks).toEqual([
      { fileKey: "big", start: 0, count: 3000 },
      { fileKey: "big", start: 3000, count: 3000 },
      { fileKey: "big", start: 6000, count: 1000 },
    ]);
  });

  it("throws when the export has no rows", async () => {
    const { dao } = daoSpy();
    s3Mock.on(ListObjectsV2Command).resolves({ Contents: [], IsTruncated: false });
    s3Mock.on(GetObjectCommand).resolves({ Body: textBody(manifest([{ key: "f1", itemCount: 0 }])) } as never);

    await expect(
      wipeAndListExport({ phase: "wipe", source: "locations", exportArn: ORDERS_ARN, startedAt: EXPORT_TIME }, deps(dao))
    ).rejects.toThrow(/no rows/);
  });

  it("tolerates a ListObjectsV2 page that omits Contents entirely", async () => {
    const { dao } = daoSpy();
    s3Mock.on(ListObjectsV2Command).resolves({});
    s3Mock.on(GetObjectCommand).resolves({ Body: textBody(manifest([{ key: "f1", itemCount: 10 }])) } as never);

    const result = await wipeAndListExport(
      { phase: "wipe", source: "locations", exportArn: ORDERS_ARN, startedAt: EXPORT_TIME },
      deps(dao)
    );
    expect(result.chunks).toEqual([{ fileKey: "f1", start: 0, count: 10 }]);
    expect(s3Mock.commandCalls(DeleteObjectsCommand)).toHaveLength(0);
  });

  it("throws when the export ARN has no parseable ExportId", async () => {
    const { dao } = daoSpy();
    s3Mock.on(ListObjectsV2Command).resolves({ Contents: [], IsTruncated: false });

    await expect(
      wipeAndListExport(
        { phase: "wipe", source: "locations", exportArn: "arn:aws:dynamodb:us-east-1:111:table/Locations-Test/export/", startedAt: EXPORT_TIME },
        deps(dao)
      )
    ).rejects.toThrow(/Cannot parse ExportId/);
  });

  it("throws when the manifest object has no Body", async () => {
    const { dao } = daoSpy();
    s3Mock.on(ListObjectsV2Command).resolves({ Contents: [], IsTruncated: false });
    s3Mock.on(GetObjectCommand).resolves({});

    await expect(
      wipeAndListExport({ phase: "wipe", source: "locations", exportArn: ORDERS_ARN, startedAt: EXPORT_TIME }, deps(dao))
    ).rejects.toThrow(/Empty object/);
  });

  it("paginates the data/ wipe", async () => {
    const { dao } = daoSpy();
    s3Mock
      .on(ListObjectsV2Command)
      .resolvesOnce({ Contents: [{ Key: "data/locations/a" }], IsTruncated: true, NextContinuationToken: "t" })
      .resolves({ Contents: [{ Key: "data/locations/b" }], IsTruncated: false });
    s3Mock.on(DeleteObjectsCommand).resolves({});
    s3Mock.on(GetObjectCommand).resolves({ Body: textBody(manifest([{ key: "f1", itemCount: 10 }])) } as never);

    await wipeAndListExport(
      { phase: "wipe", source: "locations", exportArn: ORDERS_ARN, startedAt: EXPORT_TIME },
      deps(dao)
    );
    expect(s3Mock.commandCalls(DeleteObjectsCommand)).toHaveLength(2);
  });
});

describe("replayExportChunk", () => {
  it("reads only its line range, routes #METADATA / EVENT# rows, and stamps REBUILD + exportTime", async () => {
    const { dao } = daoSpy();
    s3Mock.on(GetObjectCommand, { Key: "f1" }).resolves({
      Body: gzLines([
        { order_id: "skip", sk: "#METADATA" },
        { order_id: "o1", sk: "#METADATA", current_stage: "INGEST" },
        { order_id: "o1", sk: "EVENT#0" },
        { order_id: "o1", sk: "EVENT#1" },
      ]),
    } as never);

    const replayed = await replayExportChunk(
      { phase: "replay", source: "orders", chunk: { fileKey: "f1", start: 1, count: 3 }, exportTime: EXPORT_TIME },
      deps(dao)
    );

    expect(replayed).toEqual({ order_snapshots: 1, order_events: 2 });
    const snap = firehoseMock
      .commandCalls(PutRecordBatchCommand)
      .find((c) => c.args[0].input.DeliveryStreamName === FIREHOSE_ENV.ORDER_SNAPSHOTS_FIREHOSE_NAME);
    const rec = JSON.parse(Buffer.from(snap!.args[0].input.Records![0].Data as Uint8Array).toString("utf-8"));
    expect(rec).toMatchObject({ order_id: "o1", ingestion_source: "REBUILD", warehouse_ingested_at: EXPORT_TIME });
  });

  it("filters the request cursor sentinel row", async () => {
    const { dao } = daoSpy();
    s3Mock.on(GetObjectCommand).resolves({
      Body: gzLines([
        { request_id: "CURSOR#NYC_311" },
        { request_id: "r1", external_unique_key: "ext-1" },
      ]),
    } as never);

    const replayed = await replayExportChunk(
      { phase: "replay", source: "requests", chunk: { fileKey: "f1", start: 0, count: 2 }, exportTime: EXPORT_TIME },
      deps(dao)
    );
    expect(replayed).toEqual({ requests: 1 });
  });

  it("retries only the records Firehose reports failed, with backoff", async () => {
    const { dao } = daoSpy();
    s3Mock.on(GetObjectCommand).resolves({ Body: gzLines([{ location_id: "l1" }, { location_id: "l2" }]) } as never);
    firehoseMock
      .on(PutRecordBatchCommand)
      .resolvesOnce({ FailedPutCount: 1, RequestResponses: [{ RecordId: "ok" }, { ErrorCode: "ServiceUnavailableException" }] })
      .resolves({ FailedPutCount: 0 });

    const replayed = await replayExportChunk(
      { phase: "replay", source: "locations", chunk: { fileKey: "f1", start: 0, count: 2 }, exportTime: EXPORT_TIME },
      deps(dao)
    );
    expect(replayed).toEqual({ locations: 2 });
    expect(firehoseMock.commandCalls(PutRecordBatchCommand)).toHaveLength(2);
  });

  it("throws when Firehose never drains a batch", async () => {
    const { dao } = daoSpy();
    s3Mock.on(GetObjectCommand).resolves({ Body: gzLines([{ location_id: "l1" }]) } as never);
    firehoseMock.on(PutRecordBatchCommand).resolves({ FailedPutCount: 1, RequestResponses: [{ ErrorCode: "InternalFailure" }] });

    await expect(
      replayExportChunk(
        { phase: "replay", source: "locations", chunk: { fileKey: "f1", start: 0, count: 1 }, exportTime: EXPORT_TIME },
        deps(dao)
      )
    ).rejects.toThrow(/unwritten/);
  });

  it("throws when the export data file object has no Body", async () => {
    const { dao } = daoSpy();
    s3Mock.on(GetObjectCommand).resolves({});

    await expect(
      replayExportChunk(
        { phase: "replay", source: "locations", chunk: { fileKey: "f1", start: 0, count: 1 }, exportTime: EXPORT_TIME },
        deps(dao)
      )
    ).rejects.toThrow(/Empty object/);
  });

  it("succeeds even when Firehose reports a failure but omits RequestResponses entirely", async () => {
    /* A `FailedPutCount > 0` response with no `RequestResponses` key exercises the `?? []` fallback —
     * every pending record then filters out (no ErrorCode to match), so the retry loop exits clean. */
    const { dao } = daoSpy();
    s3Mock.on(GetObjectCommand).resolves({ Body: gzLines([{ location_id: "l1" }]) } as never);
    firehoseMock.on(PutRecordBatchCommand).resolves({ FailedPutCount: 1 });

    const replayed = await replayExportChunk(
      { phase: "replay", source: "locations", chunk: { fileKey: "f1", start: 0, count: 1 }, exportTime: EXPORT_TIME },
      deps(dao)
    );
    expect(replayed).toEqual({ locations: 1 });
    expect(firehoseMock.commandCalls(PutRecordBatchCommand)).toHaveLength(1);
  });

  it("uses the real backoff sleep when none is injected", async () => {
    /* Omitting `sleep` from deps exercises the default `(ms) => delayMs(ms)` closure — a real,
     * short (400ms) wait rather than a fake one, since this is the one path that must actually pace retries. */
    const { dao } = daoSpy();
    s3Mock.on(GetObjectCommand).resolves({ Body: gzLines([{ location_id: "l1" }]) } as never);
    firehoseMock
      .on(PutRecordBatchCommand)
      .resolvesOnce({ FailedPutCount: 1, RequestResponses: [{ ErrorCode: "ServiceUnavailableException" }] })
      .resolves({ FailedPutCount: 0 });

    const replayed = await replayExportChunk(
      { phase: "replay", source: "locations", chunk: { fileKey: "f1", start: 0, count: 1 }, exportTime: EXPORT_TIME },
      depsNoClock(dao)
    );
    expect(replayed).toEqual({ locations: 1 });
    expect(firehoseMock.commandCalls(PutRecordBatchCommand)).toHaveLength(2);
  }, 10_000);
});

describe("finalizeRebuild", () => {
  it("sums the per-chunk counts, closes the row SUCCEEDED, and drops the export staging", async () => {
    const { dao, putJobRun } = daoSpy();
    s3Mock.on(ListObjectsV2Command).resolves({ Contents: [{ Key: "export-staging/orders/x" }], IsTruncated: false });
    s3Mock.on(DeleteObjectsCommand).resolves({});

    const result = await finalizeRebuild(
      {
        phase: "finalize",
        source: "orders",
        exportArn: ORDERS_ARN,
        jobRunId: "01RUN",
        startedAt: EXPORT_TIME,
        replayResults: [
          { order_snapshots: 100, order_events: 400 },
          { order_snapshots: 50, order_events: 900 },
        ],
      },
      deps(dao)
    );

    expect(result).toEqual({
      source: "orders",
      job_run_id: "01RUN",
      replayed_by_table: { order_snapshots: 150, order_events: 1300 },
      total_replayed: 1450,
    });
    expect(putJobRun.mock.calls[0][0]).toMatchObject({ job_run_id: "01RUN", status: "SUCCEEDED", row_count: 1450 });
    const del = s3Mock.commandCalls(DeleteObjectsCommand)[0].args[0].input;
    expect((del.Delete!.Objects ?? [])[0].Key).toBe("export-staging/orders/x");
  });

  it("uses the real clock's completed_at when no now() is injected", async () => {
    /* Omitting `now` exercises the default `() => new Date()` closure. */
    const { dao, putJobRun } = daoSpy();
    s3Mock.on(ListObjectsV2Command).resolves({ Contents: [], IsTruncated: false });
    s3Mock.on(DeleteObjectsCommand).resolves({});

    await finalizeRebuild(
      {
        phase: "finalize",
        source: "orders",
        exportArn: ORDERS_ARN,
        jobRunId: "01RUN",
        startedAt: EXPORT_TIME,
        replayResults: [],
      },
      depsNoClock(dao)
    );

    expect(putJobRun.mock.calls[0][0].completed_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("markRebuildFailed", () => {
  it("closes the given job row as FAILED with the (truncated) error", async () => {
    const { dao, putJobRun } = daoSpy();
    await markRebuildFailed(
      { phase: "fail", source: "requests", exportArn: REQ_ARN, startedAt: EXPORT_TIME, jobRunId: "01RUN", error: "x".repeat(2000) },
      deps(dao)
    );
    const row = putJobRun.mock.calls[0][0];
    expect(row).toMatchObject({ job_run_id: "01RUN", job_name: "REBUILD_REQUESTS", status: "FAILED" });
    expect(row.error_message).toHaveLength(1000);
  });

  it("opens a fresh FAILED row when the wipe phase failed before a run id existed", async () => {
    const { dao, putJobRun } = daoSpy();
    await markRebuildFailed(
      { phase: "fail", source: "locations", exportArn: ORDERS_ARN, startedAt: EXPORT_TIME },
      deps(dao)
    );
    const row = putJobRun.mock.calls[0][0];
    expect(row).toMatchObject({ status: "FAILED", error_message: "rebuild failed" });
    expect(row.job_run_id).toBeTruthy();
  });
});

describe("default deps", () => {
  it("constructs S3 / Firehose / DAO clients from env when omitted", async () => {
    process.env["WAREHOUSE_BUCKET_NAME"] = BUCKET;
    s3Mock.on(ListObjectsV2Command).resolves({ Contents: [], IsTruncated: false });
    s3Mock.on(DeleteObjectsCommand).resolves({});
    s3Mock.on(GetObjectCommand).resolves({ Body: gzLines([{ location_id: "l1" }]) } as never);
    try {
      const replayed = await replayExportChunk({
        phase: "replay",
        source: "locations",
        chunk: { fileKey: "f1", start: 0, count: 1 },
        exportTime: EXPORT_TIME,
      });
      expect(replayed).toEqual({ locations: 1 });
    } finally {
      delete process.env["WAREHOUSE_BUCKET_NAME"];
    }
  });

  it("throws a clear error when WAREHOUSE_BUCKET_NAME is unset", async () => {
    const prev = process.env["WAREHOUSE_BUCKET_NAME"];
    delete process.env["WAREHOUSE_BUCKET_NAME"];
    try {
      await expect(
        replayExportChunk({
          phase: "replay",
          source: "locations",
          chunk: { fileKey: "f1", start: 0, count: 1 },
          exportTime: EXPORT_TIME,
        })
      ).rejects.toThrow("WAREHOUSE_BUCKET_NAME");
    } finally {
      if (prev !== undefined) process.env["WAREHOUSE_BUCKET_NAME"] = prev;
    }
  });
});
