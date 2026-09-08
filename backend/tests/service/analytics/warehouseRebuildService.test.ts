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
import { rebuildSource } from "../../../service/analytics/warehouseRebuildService";
import type { WarehouseJobRunsDao } from "../../../dao/analytics/warehouseJobRunsDao";
import type { WarehouseJobRun } from "../../../models/warehouseJobRun";

const s3Mock = mockClient(S3Client);
const s3Client = new S3Client({});
const firehoseMock = mockClient(FirehoseClient);
const firehoseClient = new FirehoseClient({});

const BUCKET = "nyc311-warehouse-test";
const EXPORT_ARN = "arn:aws:dynamodb:us-east-1:111:table/Orders-Test/export/01EXPORTID";
const EXPORT_TIME = "2026-09-08T12:00:00.000Z";

const FIREHOSE_ENV = {
  ORDER_EVENTS_FIREHOSE_NAME: "Nyc311Warehouse-OrderEvents-Test",
  ORDER_SNAPSHOTS_FIREHOSE_NAME: "Nyc311Warehouse-OrderSnapshots-Test",
  REQUESTS_FIREHOSE_NAME: "Nyc311Warehouse-Requests-Test",
  LOCATIONS_FIREHOSE_NAME: "Nyc311Warehouse-Locations-Test",
} as const;

function putRunSpy() {
  const putJobRun = vi.fn<(run: WarehouseJobRun) => Promise<void>>().mockResolvedValue(undefined);
  return { dao: { putJobRun } as unknown as WarehouseJobRunsDao, putJobRun };
}

/** One export data file: JSON-lines of `{ Item: <ddb-json> }`, gzipped, as `transformToByteArray` bytes. */
function exportDataFileBody(items: Record<string, unknown>[]): { transformToByteArray: () => Promise<Uint8Array> } {
  const toDdbJson = (item: Record<string, unknown>): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(item)) {
      out[k] = typeof v === "number" ? { N: String(v) } : { S: String(v) };
    }
    return out;
  };
  const lines = items.map((item) => JSON.stringify({ Item: toDdbJson(item) })).join("\n");
  const bytes = gzipSync(Buffer.from(lines, "utf-8"));
  return { transformToByteArray: async () => new Uint8Array(bytes) };
}

function textBody(text: string): { transformToString: () => Promise<string> } {
  return { transformToString: async () => text };
}

const MANIFEST = JSON.stringify({ dataFileS3Key: "export-staging/orders/AWSDynamoDB/01EXPORTID/data/f1.json.gz" });

beforeEach(() => {
  s3Mock.reset();
  firehoseMock.reset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  for (const [k, v] of Object.entries(FIREHOSE_ENV)) process.env[k] = v;
});

afterEach(() => {
  vi.restoreAllMocks();
  for (const k of Object.keys(FIREHOSE_ENV)) delete process.env[k];
});

function baseDeps(dao: WarehouseJobRunsDao) {
  return {
    s3Client,
    firehoseClient,
    jobRunsDao: dao,
    bucket: BUCKET,
    now: () => new Date("2026-09-08T13:00:00.000Z"),
  };
}

describe("rebuildSource — orders", () => {
  it("wipes both target prefixes, routes #METADATA and EVENT# rows to their Firehoses, and records a SUCCEEDED run", async () => {
    const { dao, putJobRun } = putRunSpy();
    s3Mock.on(ListObjectsV2Command).resolves({ Contents: [{ Key: "data/order_snapshots/dt=x/a.parquet" }], IsTruncated: false });
    s3Mock.on(DeleteObjectsCommand).resolves({});
    s3Mock
      .on(GetObjectCommand, { Key: "export-staging/orders/AWSDynamoDB/01EXPORTID/manifest-files.json" })
      .resolves({ Body: textBody(MANIFEST) } as never)
      .on(GetObjectCommand, { Key: "export-staging/orders/AWSDynamoDB/01EXPORTID/data/f1.json.gz" })
      .resolves({
        Body: exportDataFileBody([
          { order_id: "o1", sk: "#METADATA", current_stage: "INGEST" },
          { order_id: "o1", sk: "EVENT#0", event_type: "ORDER_CREATED" },
          { order_id: "o1", sk: "EVENT#1", event_type: "ORDER_ACCEPTED" },
        ]),
      } as never);
    firehoseMock.on(PutRecordBatchCommand).resolves({ FailedPutCount: 0 });

    const result = await rebuildSource(
      { source: "orders", exportArn: EXPORT_ARN, exportTime: EXPORT_TIME },
      baseDeps(dao)
    );

    expect(result.wiped_prefixes).toEqual(["data/order_snapshots/", "data/order_events/"]);
    expect(result.replayed_by_table).toEqual({ order_snapshots: 1, order_events: 2 });
    expect(result.total_replayed).toBe(3);

    const snapshotPut = firehoseMock
      .commandCalls(PutRecordBatchCommand)
      .find((c) => c.args[0].input.DeliveryStreamName === FIREHOSE_ENV.ORDER_SNAPSHOTS_FIREHOSE_NAME);
    const record = JSON.parse(Buffer.from(snapshotPut!.args[0].input.Records![0].Data as Uint8Array).toString("utf-8"));
    expect(record).toMatchObject({ order_id: "o1", ingestion_source: "REBUILD", warehouse_ingested_at: EXPORT_TIME });

    const statuses = putJobRun.mock.calls.map((c) => c[0].status);
    expect(statuses).toEqual(["RUNNING", "SUCCEEDED"]);
    expect(putJobRun.mock.calls[1][0]).toMatchObject({ job_name: "REBUILD_ORDERS", trigger: "MANUAL", row_count: 3 });
  });
});

describe("rebuildSource — requests / locations filters", () => {
  it("skips the request cursor sentinel row (no external_unique_key)", async () => {
    const { dao } = putRunSpy();
    s3Mock.on(ListObjectsV2Command).resolves({ Contents: [], IsTruncated: false });
    s3Mock.on(DeleteObjectsCommand).resolves({});
    s3Mock
      .on(GetObjectCommand, { Key: "export-staging/requests/AWSDynamoDB/01EXPORTID/manifest-files.json" })
      .resolves({ Body: textBody(JSON.stringify({ dataFileS3Key: "export-staging/requests/AWSDynamoDB/01EXPORTID/data/f1.json.gz" })) } as never)
      .on(GetObjectCommand, { Key: "export-staging/requests/AWSDynamoDB/01EXPORTID/data/f1.json.gz" })
      .resolves({
        Body: exportDataFileBody([
          { request_id: "CURSOR#NYC_311", cursor_value: "abc" },
          { request_id: "r1", external_unique_key: "ext-1" },
        ]),
      } as never);
    firehoseMock.on(PutRecordBatchCommand).resolves({ FailedPutCount: 0 });

    const result = await rebuildSource(
      { source: "requests", exportArn: EXPORT_ARN.replace("Orders", "Requests"), exportTime: EXPORT_TIME },
      baseDeps(dao)
    );

    expect(result.replayed_by_table).toEqual({ requests: 1 });
  });

  it("skips non-location rows (no location_id)", async () => {
    const { dao } = putRunSpy();
    s3Mock.on(ListObjectsV2Command).resolves({ Contents: [], IsTruncated: false });
    s3Mock.on(DeleteObjectsCommand).resolves({});
    s3Mock
      .on(GetObjectCommand, { Key: "export-staging/locations/AWSDynamoDB/01EXPORTID/manifest-files.json" })
      .resolves({ Body: textBody(JSON.stringify({ dataFileS3Key: "export-staging/locations/AWSDynamoDB/01EXPORTID/data/f1.json.gz" })) } as never)
      .on(GetObjectCommand, { Key: "export-staging/locations/AWSDynamoDB/01EXPORTID/data/f1.json.gz" })
      .resolves({
        Body: exportDataFileBody([
          { something_else: "x" },
          { location_id: "l1", borough: "BRONX" },
        ]),
      } as never);
    firehoseMock.on(PutRecordBatchCommand).resolves({ FailedPutCount: 0 });

    const result = await rebuildSource(
      { source: "locations", exportArn: EXPORT_ARN.replace("Orders", "Locations"), exportTime: EXPORT_TIME },
      baseDeps(dao)
    );

    expect(result.replayed_by_table).toEqual({ locations: 1 });
  });
});

describe("rebuildSource — Firehose failures", () => {
  function stubHappyS3(oneRow: Record<string, unknown>) {
    s3Mock.on(ListObjectsV2Command).resolves({ Contents: [], IsTruncated: false });
    s3Mock.on(DeleteObjectsCommand).resolves({});
    s3Mock
      .on(GetObjectCommand, { Key: "export-staging/locations/AWSDynamoDB/01EXPORTID/manifest-files.json" })
      .resolves({ Body: textBody(JSON.stringify({ dataFileS3Key: "export-staging/locations/AWSDynamoDB/01EXPORTID/data/f1.json.gz" })) } as never)
      .on(GetObjectCommand, { Key: "export-staging/locations/AWSDynamoDB/01EXPORTID/data/f1.json.gz" })
      .resolves({ Body: exportDataFileBody([oneRow]) } as never);
  }

  it("retries only the failed records, then succeeds", async () => {
    const { dao } = putRunSpy();
    stubHappyS3({ location_id: "l1" });
    firehoseMock
      .on(PutRecordBatchCommand)
      .resolvesOnce({ FailedPutCount: 1, RequestResponses: [{ ErrorCode: "ServiceUnavailable" }] })
      .resolves({ FailedPutCount: 0 });

    const result = await rebuildSource(
      { source: "locations", exportArn: EXPORT_ARN.replace("Orders", "Locations"), exportTime: EXPORT_TIME },
      baseDeps(dao)
    );

    expect(result.total_replayed).toBe(1);
    expect(firehoseMock.commandCalls(PutRecordBatchCommand)).toHaveLength(2);
  });

  it("throws and writes a FAILED run when Firehose never drains", async () => {
    const { dao, putJobRun } = putRunSpy();
    stubHappyS3({ location_id: "l1" });
    firehoseMock.on(PutRecordBatchCommand).resolves({ FailedPutCount: 1, RequestResponses: [{ ErrorCode: "InternalFailure" }] });

    await expect(
      rebuildSource(
        { source: "locations", exportArn: EXPORT_ARN.replace("Orders", "Locations"), exportTime: EXPORT_TIME },
        baseDeps(dao)
      )
    ).rejects.toThrow(/unwritten/);

    expect(putJobRun.mock.calls.map((c) => c[0].status)).toEqual(["RUNNING", "FAILED"]);
    expect(putJobRun.mock.calls[1][0].error_message).toMatch(/unwritten/);
  });
});

describe("rebuildSource — misc", () => {
  it("paginates and batches the prefix wipe", async () => {
    const { dao } = putRunSpy();
    s3Mock
      .on(ListObjectsV2Command)
      .resolvesOnce({ Contents: [{ Key: "data/locations/a" }], IsTruncated: true, NextContinuationToken: "t2" })
      .resolves({ Contents: [{ Key: "data/locations/b" }], IsTruncated: false });
    s3Mock.on(DeleteObjectsCommand).resolves({});
    s3Mock
      .on(GetObjectCommand, { Key: "export-staging/locations/AWSDynamoDB/01EXPORTID/manifest-files.json" })
      .resolves({ Body: textBody(JSON.stringify({ dataFileS3Key: "export-staging/locations/AWSDynamoDB/01EXPORTID/data/f1.json.gz" })) } as never)
      .on(GetObjectCommand, { Key: "export-staging/locations/AWSDynamoDB/01EXPORTID/data/f1.json.gz" })
      .resolves({ Body: exportDataFileBody([]) } as never);

    await rebuildSource(
      { source: "locations", exportArn: EXPORT_ARN.replace("Orders", "Locations"), exportTime: EXPORT_TIME },
      baseDeps(dao)
    );

    expect(s3Mock.commandCalls(DeleteObjectsCommand)).toHaveLength(2);
  });

  it("throws on an unparseable export ARN", async () => {
    const { dao } = putRunSpy();
    s3Mock.on(ListObjectsV2Command).resolves({ Contents: [], IsTruncated: false });
    s3Mock.on(DeleteObjectsCommand).resolves({});

    await expect(
      rebuildSource({ source: "locations", exportArn: "", exportTime: EXPORT_TIME }, baseDeps(dao))
    ).rejects.toThrow();
  });

  it("tolerates a ListObjectsV2 page with no Contents key", async () => {
    const { dao } = putRunSpy();
    s3Mock.on(ListObjectsV2Command).resolves({});
    s3Mock.on(DeleteObjectsCommand).resolves({});
    s3Mock
      .on(GetObjectCommand, { Key: "export-staging/locations/AWSDynamoDB/01EXPORTID/manifest-files.json" })
      .resolves({ Body: textBody(JSON.stringify({ dataFileS3Key: "export-staging/locations/AWSDynamoDB/01EXPORTID/data/f1.json.gz" })) } as never)
      .on(GetObjectCommand, { Key: "export-staging/locations/AWSDynamoDB/01EXPORTID/data/f1.json.gz" })
      .resolves({ Body: exportDataFileBody([]) } as never);

    const result = await rebuildSource(
      { source: "locations", exportArn: EXPORT_ARN.replace("Orders", "Locations"), exportTime: EXPORT_TIME },
      baseDeps(dao)
    );
    expect(result.total_replayed).toBe(0);
    expect(s3Mock.commandCalls(DeleteObjectsCommand)).toHaveLength(0);
  });

  it("throws when the manifest object has no body", async () => {
    const { dao } = putRunSpy();
    s3Mock.on(ListObjectsV2Command).resolves({ Contents: [], IsTruncated: false });
    s3Mock.on(DeleteObjectsCommand).resolves({});
    s3Mock.on(GetObjectCommand, { Key: "export-staging/locations/AWSDynamoDB/01EXPORTID/manifest-files.json" }).resolves({} as never);

    await expect(
      rebuildSource(
        { source: "locations", exportArn: EXPORT_ARN.replace("Orders", "Locations"), exportTime: EXPORT_TIME },
        baseDeps(dao)
      )
    ).rejects.toThrow(/Empty object/);
  });

  it("throws when an export data file object has no body", async () => {
    const { dao } = putRunSpy();
    s3Mock.on(ListObjectsV2Command).resolves({ Contents: [], IsTruncated: false });
    s3Mock.on(DeleteObjectsCommand).resolves({});
    s3Mock
      .on(GetObjectCommand, { Key: "export-staging/locations/AWSDynamoDB/01EXPORTID/manifest-files.json" })
      .resolves({ Body: textBody(JSON.stringify({ dataFileS3Key: "export-staging/locations/AWSDynamoDB/01EXPORTID/data/f1.json.gz" })) } as never)
      .on(GetObjectCommand, { Key: "export-staging/locations/AWSDynamoDB/01EXPORTID/data/f1.json.gz" })
      .resolves({} as never);

    await expect(
      rebuildSource(
        { source: "locations", exportArn: EXPORT_ARN.replace("Orders", "Locations"), exportTime: EXPORT_TIME },
        baseDeps(dao)
      )
    ).rejects.toThrow(/Empty object/);
  });

  it("stringifies a non-Error throw in the FAILED run row", async () => {
    const { dao, putJobRun } = putRunSpy();
    s3Mock.on(ListObjectsV2Command).callsFake(() => {
      throw "s3 exploded";
    });

    await expect(
      rebuildSource(
        { source: "locations", exportArn: EXPORT_ARN.replace("Orders", "Locations"), exportTime: EXPORT_TIME },
        baseDeps(dao)
      )
    ).rejects.toBeDefined();
    expect(putJobRun.mock.calls[1][0].status).toBe("FAILED");
    expect(putJobRun.mock.calls[1][0].error_message).toBe("s3 exploded");
  });

  it("constructs default clients + bucket from env when deps are omitted", async () => {
    const { dao } = putRunSpy();
    process.env["WAREHOUSE_BUCKET_NAME"] = BUCKET;
    s3Mock.on(ListObjectsV2Command).resolves({ Contents: [], IsTruncated: false });
    s3Mock.on(DeleteObjectsCommand).resolves({});
    s3Mock
      .on(GetObjectCommand, { Key: "export-staging/locations/AWSDynamoDB/01EXPORTID/manifest-files.json" })
      .resolves({ Body: textBody(JSON.stringify({ dataFileS3Key: "export-staging/locations/AWSDynamoDB/01EXPORTID/data/f1.json.gz" })) } as never)
      .on(GetObjectCommand, { Key: "export-staging/locations/AWSDynamoDB/01EXPORTID/data/f1.json.gz" })
      .resolves({ Body: exportDataFileBody([]) } as never);
    try {
      const result = await rebuildSource(
        { source: "locations", exportArn: EXPORT_ARN.replace("Orders", "Locations"), exportTime: EXPORT_TIME },
        { jobRunsDao: dao }
      );
      expect(result.total_replayed).toBe(0);
    } finally {
      delete process.env["WAREHOUSE_BUCKET_NAME"];
    }
  });
});
