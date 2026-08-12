import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RequestDao } from "../../../dao/request/requestDao";
import { pollNyc311 } from "../../../service/ingestion/nyc311PollerService";
import type { Request } from "../../../models/request";
import normalWithBbl from "./nyc311-normal-with-bbl.json";
import missingUniqueKey from "./nyc311-missing-unique-key.json";

const TABLE_NAME = "Requests";
const ddbMock = mockClient(DynamoDBDocumentClient);
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const requestDao = new RequestDao(client, TABLE_NAME);

// Fixed "now" so watermark/window assertions are deterministic.
const NOW = new Date("2026-08-11T12:00:00.000Z");
const now = () => NOW;

function makeRawRecords(count: number, startAt: number): unknown[] {
  return Array.from({ length: count }, (_, i) => ({
    unique_key: `gen-${startAt + i}`,
    created_date: "2026-08-10T00:00:00.000",
  }));
}

beforeEach(() => {
  ddbMock.reset();
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
    ddbMock.on(GetCommand).resolves({}); // no cursor item, and no dedup match
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    ddbMock.on(PutCommand).resolves({});

    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce([normalWithBbl]) // one page, shorter than the limit -> drained
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

    // created_date is well within the 24h safety-lag window relative to `now` —
    // the watermark should NOT advance all the way to it.
    const recentRecord = { unique_key: "recent-1", created_date: "2026-08-11T11:00:00.000" };
    const fetchPage = vi.fn().mockResolvedValueOnce([recentRecord]).mockResolvedValue([]);

    await pollNyc311({ requestDao, now, fetchPage });

    const cursorPut = ddbMock
      .commandCalls(PutCommand)
      .find((c) => c.args[0].input.Item?.["request_id"] === "CURSOR#NYC_311");
    expect(cursorPut).toBeDefined();
    // now (12:00) - 24h safety lag = 2026-08-10T12:00:00, the initial window start —
    // the record's created_date (11:00 the next day) is inside the lag window, so
    // the watermark stays at the window start rather than jumping to it.
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

    // Every page comes back completely full (== the requested limit), so the
    // poller can never conclude the window drained — it must stop once it
    // hits the 2000-record per-run cap instead.
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
});
