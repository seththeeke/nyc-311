import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RequestDao } from "../../../dao/request/requestDao";
import {
  pollNyc311,
  recordPollerMetrics,
  listPollerMetrics,
  getCursorStatus,
  fanOutRequestRecord,
} from "../../../service/ingestion/nyc311RequestService";
import type { Request } from "../../../models/request";
import type { PollerMetrics } from "../../../models/pollerMetrics";
import type { RequestStreamRecord } from "../../../models/requestStreamEvent";
import normalWithBbl from "./nyc311-normal-with-bbl.json";
import missingUniqueKey from "./nyc311-missing-unique-key.json";

const TABLE_NAME = "Requests";
const ddbMock = mockClient(DynamoDBDocumentClient);
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const requestDao = new RequestDao(client, TABLE_NAME);

const QUEUE_URL = "https://sqs.us-east-1.amazonaws.com/123456789012/OrderIngestion";
const sqsMock = mockClient(SQSClient);
const sqsClient = new SQSClient({});

/* Fixed "now" so watermark/window assertions are deterministic. */
const NOW = new Date("2026-08-11T12:00:00.000Z");
const now = () => NOW;

function makeRawRecords(count: number, startAt: number): unknown[] {
  return Array.from({ length: count }, (_, i) => ({
    unique_key: `gen-${startAt + i}`,
    created_date: "2026-08-10T00:00:00.000",
  }));
}

function makeStreamRecord(overrides: Partial<RequestStreamRecord> = {}): RequestStreamRecord {
  return {
    eventName: "INSERT",
    dynamodb: {
      NewImage: {
        request_id: { S: "01ABCDEF" },
        external_unique_key: { S: "12345" },
        status: { S: "DRAFT" },
      },
      SequenceNumber: "111",
    },
    ...overrides,
  };
}

beforeEach(() => {
  ddbMock.reset();
  sqsMock.reset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("pollNyc311", () => {
  it("first-ever run: computes a 24h initial window and ingests new records", async () => {
    ddbMock.on(GetCommand).resolves({}); /* no cursor item, and no dedup match */
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    ddbMock.on(PutCommand).resolves({});

    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce([normalWithBbl]) /* one page, shorter than the limit -> drained */
      .mockResolvedValue([]);

    const result = await pollNyc311({ requestDao, now, fetchPage });

    expect(result).toEqual({ recordsIngested: 1, duplicatesSkipped: 0, recordsRejected: 0 });
    expect(fetchPage).toHaveBeenCalledWith({
      sinceExclusive: "2026-08-10T12:00:00",
      offset: 0,
      limit: 1000,
    });

    const putRequestCall = ddbMock
      .commandCalls(PutCommand)
      .find((c) => c.args[0].input.Item?.request_id !== undefined);
    expect(putRequestCall).toBeDefined();
    const written = putRequestCall?.args[0].input.Item as Request;
    expect(written).toMatchObject({
      source: "NYC_311",
      external_unique_key: "69860415",
      status: "DRAFT",
      location_id: null,
    });
  });

  it("advances the watermark on a drained window, capped by the safety lag", async () => {
    ddbMock.on(GetCommand).resolves({});
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    ddbMock.on(PutCommand).resolves({});

    /*
     * created_date is well within the 72h safety-lag window relative to `now` —
     * the watermark should NOT advance all the way to it.
     */
    const recentRecord = { unique_key: "recent-1", created_date: "2026-08-11T11:00:00.000" };
    const fetchPage = vi.fn().mockResolvedValueOnce([recentRecord]).mockResolvedValue([]);

    await pollNyc311({ requestDao, now, fetchPage });

    const cursorPut = ddbMock
      .commandCalls(PutCommand)
      .find((c) => c.args[0].input.Item?.["request_id"] === "CURSOR#NYC_311");
    expect(cursorPut).toBeDefined();
    /*
     * No cursor item -> windowStartDate = now (12:00) - 24h INITIAL_WINDOW_HOURS
     * = 2026-08-10T12:00:00. The 72h safety-lag cutoff (2026-08-08T12:00:00) is
     * even earlier, so windowStartDate itself is the binding floor here — the
     * record's created_date (11:00 the next day) never enters into it either
     * way, since cappedWatermark never regresses below windowStartDate.
     */
    expect(cursorPut?.args[0].input.Item).toMatchObject({
      last_watermark: "2026-08-10T12:00:00",
      resume_offset: null,
    });
  });

  it("advances the watermark to the last record's created_date when it's older than the safety lag", async () => {
    ddbMock.on(GetCommand).resolves({
      Item: { request_id: "CURSOR#NYC_311", last_watermark: "2026-08-01T00:00:00", resume_offset: null },
    });
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    ddbMock.on(PutCommand).resolves({});

    const oldRecord = { unique_key: "old-1", created_date: "2026-08-05T08:30:00.000" };
    const fetchPage = vi.fn().mockResolvedValueOnce([oldRecord]).mockResolvedValue([]);

    await pollNyc311({ requestDao, now, fetchPage });

    const cursorPut = ddbMock
      .commandCalls(PutCommand)
      .find((c) => c.args[0].input.Item?.["request_id"] === "CURSOR#NYC_311");
    expect(cursorPut?.args[0].input.Item).toMatchObject({
      last_watermark: "2026-08-05T08:30:00",
      resume_offset: null,
    });
  });

  it("resumes from the stored offset/watermark without recomputing the window", async () => {
    ddbMock.on(GetCommand).resolves({
      Item: { request_id: "CURSOR#NYC_311", last_watermark: "2026-08-09T00:00:00", resume_offset: 250 },
    });
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    ddbMock.on(PutCommand).resolves({});

    const fetchPage = vi.fn().mockResolvedValue([]);
    await pollNyc311({ requestDao, now, fetchPage });

    expect(fetchPage).toHaveBeenCalledWith({
      sinceExclusive: "2026-08-09T00:00:00",
      offset: 250,
      limit: 1000,
    });
  });

  it("skips a duplicate record without writing it", async () => {
    const existingRequest: Request = {
      request_id: "01EXISTING",
      source: "NYC_311",
      external_unique_key: "69860415",
      location_id: null,
      complaint_type: "Noise - Street/Sidewalk",
      descriptor: "Loud Talking",
      agency: "NYPD",
      raw_payload: {},
      status: "DRAFT",
      created_by: null,
      created_at: "2026-08-01T00:00:00.000",
    };
    ddbMock.on(GetCommand).resolves({});
    ddbMock.on(QueryCommand).resolves({ Items: [existingRequest] });
    ddbMock.on(PutCommand).resolves({});

    const fetchPage = vi.fn().mockResolvedValueOnce([normalWithBbl]).mockResolvedValue([]);
    const result = await pollNyc311({ requestDao, now, fetchPage });

    expect(result).toEqual({ recordsIngested: 0, duplicatesSkipped: 1, recordsRejected: 0 });
    const requestWrite = ddbMock
      .commandCalls(PutCommand)
      .find((c) => c.args[0].input.ConditionExpression !== undefined);
    expect(requestWrite).toBeUndefined();
  });

  it("rejects a record missing a required field without writing or dedup-checking it", async () => {
    ddbMock.on(GetCommand).resolves({});
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    ddbMock.on(PutCommand).resolves({});

    const fetchPage = vi.fn().mockResolvedValueOnce([missingUniqueKey]).mockResolvedValue([]);
    const result = await pollNyc311({ requestDao, now, fetchPage });

    expect(result).toEqual({ recordsIngested: 0, duplicatesSkipped: 0, recordsRejected: 1 });
    expect(ddbMock.commandCalls(QueryCommand)).toHaveLength(0);
  });

  it("stops at the per-run record cap without advancing the watermark, persisting resume_offset", async () => {
    ddbMock.on(GetCommand).resolves({});
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    ddbMock.on(PutCommand).resolves({});

    /*
     * Every page comes back completely full (== the requested limit), so the
     * poller can never conclude the window drained — it must stop once it
     * hits the 2000-record per-run cap instead.
     */
    const fetchPage = vi.fn().mockImplementation(({ offset, limit }: { offset: number; limit: number }) =>
      Promise.resolve(makeRawRecords(limit, offset))
    );

    const result = await pollNyc311({ requestDao, now, fetchPage });

    expect(result.recordsIngested).toBe(2000);
    expect(fetchPage).toHaveBeenCalledTimes(2);

    const cursorPut = ddbMock
      .commandCalls(PutCommand)
      .find((c) => c.args[0].input.Item?.["request_id"] === "CURSOR#NYC_311");
    expect(cursorPut?.args[0].input.Item).toMatchObject({
      last_watermark: "2026-08-10T12:00:00",
      resume_offset: 2000,
    });
  });

  it("defaults `now` to the real Date when not injected", async () => {
    ddbMock.on(GetCommand).resolves({});
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    ddbMock.on(PutCommand).resolves({});

    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const fetchPage = vi.fn().mockResolvedValue([]);

    await pollNyc311({ requestDao, fetchPage });

    expect(fetchPage).toHaveBeenCalledWith({
      sinceExclusive: "2026-08-10T12:00:00",
      offset: 0,
      limit: 1000,
    });
  });

  it("defaults `fetchPage` to the real SODA client when not injected", async () => {
    ddbMock.on(GetCommand).resolves({});
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    ddbMock.on(PutCommand).resolves({});

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    vi.stubGlobal("fetch", fetchMock);

    await pollNyc311({ requestDao, now });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(calledUrl.origin + calledUrl.pathname).toBe(
      "https://data.cityofnewyork.us/resource/erm2-nwe9.json"
    );
  });

  it("defaults `requestDao` to the module's own instance when not injected", async () => {
    /*
     * ddbMock (aws-sdk-client-mock) patches DynamoDBDocumentClient.prototype.send,
     * so it intercepts the service module's own default-constructed DAO too,
     * not just the `requestDao` built above for explicit-override tests.
     */
    ddbMock.on(GetCommand).resolves({});
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    ddbMock.on(PutCommand).resolves({});

    const fetchPage = vi.fn().mockResolvedValue([]);
    await expect(pollNyc311({ now, fetchPage })).resolves.toEqual({
      recordsIngested: 0,
      duplicatesSkipped: 0,
      recordsRejected: 0,
    });
  });
});

const validMetrics: PollerMetrics = {
  ran_at: "2026-08-15T00:00:00.000Z",
  success: true,
  records_ingested: 5,
  duplicates_skipped: 1,
  records_rejected: 0,
  error_message: null,
};

describe("recordPollerMetrics", () => {
  it("writes the metrics via the injected requestDao's putPollerMetrics", async () => {
    ddbMock.on(PutCommand).resolves({});

    await recordPollerMetrics(validMetrics, { requestDao });

    const item = ddbMock.commandCalls(PutCommand)[0].args[0].input.Item as Record<string, unknown>;
    expect(item).toMatchObject(validMetrics);
  });

  it("defaults `requestDao` to the module's own instance when not injected", async () => {
    ddbMock.on(PutCommand).resolves({});
    await expect(recordPollerMetrics(validMetrics)).resolves.toBeUndefined();
  });
});

describe("listPollerMetrics", () => {
  it("returns the injected requestDao's full run history", async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [validMetrics] });

    await expect(listPollerMetrics({ requestDao })).resolves.toEqual([validMetrics]);
  });

  it("returns an empty array when no runs have ever been recorded", async () => {
    ddbMock.on(QueryCommand).resolves({});
    await expect(listPollerMetrics({ requestDao })).resolves.toEqual([]);
  });

  it("defaults `requestDao` to the module's own instance when not injected", async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [validMetrics] });
    await expect(listPollerMetrics()).resolves.toEqual([validMetrics]);
  });
});

describe("getCursorStatus", () => {
  const CURSOR_NOW = new Date("2026-08-22T00:00:00.000Z");
  const cursorNow = () => CURSOR_NOW;

  it("returns null when no cursor item exists yet", async () => {
    ddbMock.on(GetCommand).resolves({});
    await expect(getCursorStatus({ requestDao, now: cursorNow })).resolves.toBeNull();
  });

  it("computes lag_hours and is_stale=false for a healthy, recently-drained watermark", async () => {
    ddbMock.on(GetCommand).resolves({
      Item: { request_id: "CURSOR#NYC_311", last_watermark: "2026-08-19T00:00:00", resume_offset: null },
    });

    await expect(getCursorStatus({ requestDao, now: cursorNow })).resolves.toEqual({
      last_watermark: "2026-08-19T00:00:00",
      resume_offset: null,
      lag_hours: 72,
      is_stale: false,
    });
  });

  it("flags is_stale=true once the lag exceeds 2x SAFETY_LAG_HOURS", async () => {
    ddbMock.on(GetCommand).resolves({
      Item: { request_id: "CURSOR#NYC_311", last_watermark: "2026-08-10T00:00:00", resume_offset: 72000 },
    });

    const result = await getCursorStatus({ requestDao, now: cursorNow });

    expect(result?.is_stale).toBe(true);
    expect(result?.lag_hours).toBe(288);
    expect(result?.resume_offset).toBe(72000);
  });

  it("defaults `requestDao` and `now` to the module's own instances when not injected", async () => {
    ddbMock.on(GetCommand).resolves({});
    await expect(getCursorStatus()).resolves.toBeNull();
  });

  it("returns null lag_hours/is_stale=false when the cursor item has a null last_watermark", async () => {
    ddbMock.on(GetCommand).resolves({
      Item: { request_id: "CURSOR#NYC_311", last_watermark: null, resume_offset: null },
    });

    await expect(getCursorStatus({ requestDao, now: cursorNow })).resolves.toEqual({
      last_watermark: null,
      resume_offset: null,
      lag_hours: null,
      is_stale: false,
    });
  });
});

describe("fanOutRequestRecord", () => {
  it("publishes the unmarshalled NewImage to SQS for a relevant INSERT record", async () => {
    sqsMock.on(SendMessageCommand).resolves({});

    await fanOutRequestRecord(makeStreamRecord(), { sqsClient, queueUrl: QUEUE_URL });

    const calls = sqsMock.commandCalls(SendMessageCommand);
    expect(calls).toHaveLength(1);
    const input = calls[0]?.args[0].input;
    expect(input?.QueueUrl).toBe(QUEUE_URL);
    expect(JSON.parse(input?.MessageBody as string)).toEqual({
      request_id: "01ABCDEF",
      external_unique_key: "12345",
      status: "DRAFT",
    });
  });

  it("skips a MODIFY record without publishing anything", async () => {
    await fanOutRequestRecord(makeStreamRecord({ eventName: "MODIFY" }), { sqsClient, queueUrl: QUEUE_URL });

    expect(sqsMock.calls()).toHaveLength(0);
  });

  it("skips a REMOVE record without publishing anything", async () => {
    await fanOutRequestRecord(makeStreamRecord({ eventName: "REMOVE" }), { sqsClient, queueUrl: QUEUE_URL });

    expect(sqsMock.calls()).toHaveLength(0);
  });

  it("skips an INSERT record with no NewImage at all (e.g. KEYS_ONLY delivery)", async () => {
    await fanOutRequestRecord(
      { eventName: "INSERT", dynamodb: { SequenceNumber: "111" } },
      { sqsClient, queueUrl: QUEUE_URL }
    );

    expect(sqsMock.calls()).toHaveLength(0);
  });

  it("skips an INSERT record whose NewImage has no external_unique_key (the CURSOR#NYC_311 sentinel or a poller-metrics row)", async () => {
    const record = makeStreamRecord({
      dynamodb: {
        NewImage: { last_watermark: { S: "2026-08-10T00:00:00" } },
        SequenceNumber: "222",
      },
    });

    await fanOutRequestRecord(record, { sqsClient, queueUrl: QUEUE_URL });

    expect(sqsMock.calls()).toHaveLength(0);
  });

  it("lets an SQS SendMessage failure propagate", async () => {
    sqsMock.on(SendMessageCommand).rejects(new Error("SQS unavailable"));

    await expect(fanOutRequestRecord(makeStreamRecord(), { sqsClient, queueUrl: QUEUE_URL })).rejects.toThrow(
      "SQS unavailable"
    );
  });

  it("throws when queueUrl isn't provided and ORDER_INGESTION_QUEUE_URL isn't set", async () => {
    const previous = process.env["ORDER_INGESTION_QUEUE_URL"];
    delete process.env["ORDER_INGESTION_QUEUE_URL"];

    try {
      await expect(fanOutRequestRecord(makeStreamRecord(), { sqsClient })).rejects.toThrow(
        "Missing required environment variable: ORDER_INGESTION_QUEUE_URL"
      );
    } finally {
      if (previous !== undefined) process.env["ORDER_INGESTION_QUEUE_URL"] = previous;
    }
  });

  it("falls back to ORDER_INGESTION_QUEUE_URL when queueUrl isn't provided in deps", async () => {
    const previous = process.env["ORDER_INGESTION_QUEUE_URL"];
    process.env["ORDER_INGESTION_QUEUE_URL"] = QUEUE_URL;
    sqsMock.on(SendMessageCommand).resolves({});

    try {
      await fanOutRequestRecord(makeStreamRecord(), { sqsClient });

      const calls = sqsMock.commandCalls(SendMessageCommand);
      expect(calls[0]?.args[0].input.QueueUrl).toBe(QUEUE_URL);
    } finally {
      if (previous === undefined) delete process.env["ORDER_INGESTION_QUEUE_URL"];
      else process.env["ORDER_INGESTION_QUEUE_URL"] = previous;
    }
  });

  it("falls back to a freshly constructed SQSClient when sqsClient isn't provided in deps", async () => {
    const previous = process.env["ORDER_INGESTION_QUEUE_URL"];
    process.env["ORDER_INGESTION_QUEUE_URL"] = QUEUE_URL;
    sqsMock.on(SendMessageCommand).resolves({});

    try {
      await fanOutRequestRecord(makeStreamRecord());

      expect(sqsMock.commandCalls(SendMessageCommand)).toHaveLength(1);
    } finally {
      if (previous === undefined) delete process.env["ORDER_INGESTION_QUEUE_URL"];
      else process.env["ORDER_INGESTION_QUEUE_URL"] = previous;
    }
  });
});

describe("module wiring", () => {
  it("does not throw on import when REQUESTS_TABLE_NAME is unset (lazy construction, CLAUDE.md §5.2)", async () => {
    const previous = process.env.REQUESTS_TABLE_NAME;
    delete process.env.REQUESTS_TABLE_NAME;
    vi.resetModules();

    await expect(import("../../../service/ingestion/nyc311RequestService.js")).resolves.toBeDefined();

    process.env.REQUESTS_TABLE_NAME = previous;
    vi.resetModules();
  });

  it("throws only when pollNyc311 is actually called without deps.requestDao and the env var is unset", async () => {
    const previous = process.env.REQUESTS_TABLE_NAME;
    delete process.env.REQUESTS_TABLE_NAME;
    vi.resetModules();
    const { pollNyc311: freshPollNyc311 } = await import("../../../service/ingestion/nyc311RequestService.js");

    await expect(freshPollNyc311()).rejects.toThrow("Missing required environment variable: REQUESTS_TABLE_NAME");

    process.env.REQUESTS_TABLE_NAME = previous;
    vi.resetModules();
  });
});
