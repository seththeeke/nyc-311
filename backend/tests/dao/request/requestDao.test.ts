import { ConditionalCheckFailedException, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RequestDao } from "../../../dao/request/requestDao";
import { TerminalError, ValidationError } from "../../../models/errors";
import type { Request } from "../../../models/request";
import type { PollerMetrics } from "../../../models/pollerMetrics";

const TABLE_NAME = "Requests";

const validRequest: Request = {
  request_id: "01J0000000000000000000000",
  source: "NYC_311",
  external_unique_key: "69243509",
  location_id: null,
  complaint_type: "Noise - Residential",
  descriptor: "Banging/Pounding",
  agency: "NYPD",
  raw_payload: { unique_key: "69243509" },
  status: "DRAFT",
  created_by: null,
  created_at: "2026-06-05T01:50:27.000",
};

const ddbMock = mockClient(DynamoDBDocumentClient);
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const dao = new RequestDao(client, TABLE_NAME);

let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  ddbMock.reset();
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("putRequest", () => {
  it("writes with a duplicate-guard ConditionExpression", async () => {
    ddbMock.on(PutCommand).resolves({});
    await dao.putRequest(validRequest);
    const input = ddbMock.commandCalls(PutCommand)[0].args[0].input;
    expect(input).toMatchObject({
      TableName: TABLE_NAME,
      Item: validRequest,
      ConditionExpression: "attribute_not_exists(request_id)",
    });
  });

  it("derives gsi1pk/gsi2pk/gsi2sk, and omits gsi3pk/gsi3sk while location_id is null", async () => {
    ddbMock.on(PutCommand).resolves({});
    await dao.putRequest(validRequest);
    const item = ddbMock.commandCalls(PutCommand)[0].args[0].input.Item as Record<string, unknown>;
    expect(item).toMatchObject({
      gsi1pk: validRequest.external_unique_key,
      gsi2pk: validRequest.status,
      gsi2sk: validRequest.created_at,
    });
    expect(item).not.toHaveProperty("gsi3pk");
    expect(item).not.toHaveProperty("gsi3sk");
  });

  it("also derives gsi3pk/gsi3sk once location_id is set", async () => {
    ddbMock.on(PutCommand).resolves({});
    const resolvedRequest: Request = { ...validRequest, location_id: "1234567890" };
    await dao.putRequest(resolvedRequest);
    const item = ddbMock.commandCalls(PutCommand)[0].args[0].input.Item as Record<string, unknown>;
    expect(item).toMatchObject({
      gsi3pk: "1234567890",
      gsi3sk: resolvedRequest.created_at,
    });
  });

  it("throws ValidationError for a malformed Request", async () => {
    ddbMock.on(PutCommand).resolves({});
    // @ts-expect-error intentionally invalid for the test
    await expect(dao.putRequest({ ...validRequest, source: "public_demo" })).rejects.toBeInstanceOf(
      ValidationError
    );
  });

  it("wraps a duplicate request_id as TerminalError", async () => {
    ddbMock
      .on(PutCommand)
      .rejects(new ConditionalCheckFailedException({ message: "duplicate", $metadata: {} }));
    await expect(dao.putRequest(validRequest)).rejects.toMatchObject({ name: "TerminalError" });
  });
});

describe("getRequestById", () => {
  it("returns the Request when found", async () => {
    ddbMock.on(GetCommand).resolves({ Item: validRequest });
    await expect(dao.getRequestById(validRequest.request_id)).resolves.toEqual(validRequest);
    expect(ddbMock.commandCalls(GetCommand)[0].args[0].input).toMatchObject({
      TableName: TABLE_NAME,
      Key: { request_id: validRequest.request_id },
    });
  });

  it("returns null when not found", async () => {
    ddbMock.on(GetCommand).resolves({});
    await expect(dao.getRequestById("missing")).resolves.toBeNull();
  });
});

describe("findByExternalUniqueKey", () => {
  it("returns the matching Request when found", async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [validRequest] });
    await expect(dao.findByExternalUniqueKey(validRequest.external_unique_key)).resolves.toEqual(
      validRequest
    );
    const input = ddbMock.commandCalls(QueryCommand)[0].args[0].input;
    expect(input).toMatchObject({
      TableName: TABLE_NAME,
      IndexName: "gsi1-external-key",
      ExpressionAttributeValues: { ":externalUniqueKey": validRequest.external_unique_key },
    });
  });

  it("returns null when no match", async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    await expect(dao.findByExternalUniqueKey("nope")).resolves.toBeNull();
  });

  it("logs the external unique key input", async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    await dao.findByExternalUniqueKey("69243509");
    const logged = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(logged).toMatchObject({ table: TABLE_NAME, externalUniqueKey: "69243509" });
  });

  it("throws ValidationError when the matched item is malformed", async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [{ request_id: "x" }] });
    await expect(dao.findByExternalUniqueKey("x")).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("getCursor", () => {
  it("returns the cursor when it exists", async () => {
    ddbMock.on(GetCommand).resolves({
      Item: { request_id: "CURSOR#NYC_311", last_watermark: "2026-08-10T00:00:00.000Z", resume_offset: null },
    });
    await expect(dao.getCursor()).resolves.toEqual({
      last_watermark: "2026-08-10T00:00:00.000Z",
      resume_offset: null,
    });
    expect(ddbMock.commandCalls(GetCommand)[0].args[0].input).toMatchObject({
      TableName: TABLE_NAME,
      Key: { request_id: "CURSOR#NYC_311" },
    });
  });

  it("returns null on the very first run (no cursor item yet)", async () => {
    ddbMock.on(GetCommand).resolves({});
    await expect(dao.getCursor()).resolves.toBeNull();
  });

  it("logs the sentinel key it's about to read", async () => {
    ddbMock.on(GetCommand).resolves({});
    await dao.getCursor();
    const logged = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(logged).toMatchObject({ table: TABLE_NAME, sentinelKey: "CURSOR#NYC_311" });
  });

  it("throws ValidationError when the stored cursor is malformed", async () => {
    ddbMock.on(GetCommand).resolves({ Item: { request_id: "CURSOR#NYC_311", resume_offset: -1 } });
    await expect(dao.getCursor()).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("putCursor", () => {
  it("writes the sentinel item with the cursor fields", async () => {
    ddbMock.on(PutCommand).resolves({});
    await dao.putCursor({ last_watermark: "2026-08-10T00:00:00.000Z", resume_offset: 40 });
    const input = ddbMock.commandCalls(PutCommand)[0].args[0].input;
    expect(input).toEqual({
      TableName: TABLE_NAME,
      Item: {
        request_id: "CURSOR#NYC_311",
        last_watermark: "2026-08-10T00:00:00.000Z",
        resume_offset: 40,
      },
    });
  });

  it("logs the cursor input", async () => {
    ddbMock.on(PutCommand).resolves({});
    await dao.putCursor({ last_watermark: "2026-08-10T00:00:00.000Z", resume_offset: 40 });
    const logged = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(logged).toMatchObject({
      table: TABLE_NAME,
      cursor: { last_watermark: "2026-08-10T00:00:00.000Z", resume_offset: 40 },
    });
  });

  it("throws ValidationError for an invalid cursor", async () => {
    ddbMock.on(PutCommand).resolves({});
    await expect(dao.putCursor({ last_watermark: null, resume_offset: -1 })).rejects.toBeInstanceOf(
      ValidationError
    );
    expect(ddbMock.commandCalls(PutCommand)).toHaveLength(0);
  });
});

const validMetrics: PollerMetrics = {
  ran_at: "2026-08-15T00:00:00.000Z",
  success: true,
  records_ingested: 12,
  duplicates_skipped: 3,
  records_rejected: 1,
  error_message: null,
};

describe("putPollerMetrics", () => {
  it("writes a new item keyed by a fresh METRIC#<ulid>, with gsi4pk/gsi4sk set", async () => {
    ddbMock.on(PutCommand).resolves({});
    await dao.putPollerMetrics(validMetrics);
    const item = ddbMock.commandCalls(PutCommand)[0].args[0].input.Item as Record<string, unknown>;
    expect(ddbMock.commandCalls(PutCommand)[0].args[0].input.TableName).toBe(TABLE_NAME);
    expect(item.request_id).toMatch(/^METRIC#/);
    expect(item).toMatchObject({
      gsi4pk: "POLLER#METRICS",
      gsi4sk: validMetrics.ran_at,
      ...validMetrics,
    });
  });

  it("mints a different key on every call, so runs never overwrite each other", async () => {
    ddbMock.on(PutCommand).resolves({});
    await dao.putPollerMetrics(validMetrics);
    await dao.putPollerMetrics(validMetrics);
    const [first, second] = ddbMock.commandCalls(PutCommand);
    expect((first.args[0].input.Item as Record<string, unknown>).request_id).not.toBe(
      (second.args[0].input.Item as Record<string, unknown>).request_id
    );
  });

  it("logs the metrics input", async () => {
    ddbMock.on(PutCommand).resolves({});
    await dao.putPollerMetrics(validMetrics);
    const logged = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(logged).toMatchObject({ table: TABLE_NAME, metrics: validMetrics });
  });

  it("throws ValidationError for a malformed metrics record, without writing", async () => {
    ddbMock.on(PutCommand).resolves({});
    await expect(
      dao.putPollerMetrics({ ...validMetrics, records_ingested: -1 })
    ).rejects.toBeInstanceOf(ValidationError);
    expect(ddbMock.commandCalls(PutCommand)).toHaveLength(0);
  });
});

describe("listPollerMetrics", () => {
  it("queries gsi4-poller-metrics for the fixed partition key, most recent first", async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [validMetrics] });
    await expect(dao.listPollerMetrics()).resolves.toEqual([validMetrics]);
    const input = ddbMock.commandCalls(QueryCommand)[0].args[0].input;
    expect(input).toMatchObject({
      TableName: TABLE_NAME,
      IndexName: "gsi4-poller-metrics",
      ExpressionAttributeValues: { ":pk": "POLLER#METRICS" },
      ScanIndexForward: false,
    });
  });

  it("returns an empty array when no metrics have ever been recorded", async () => {
    ddbMock.on(QueryCommand).resolves({});
    await expect(dao.listPollerMetrics()).resolves.toEqual([]);
  });

  it("throws ValidationError when a stored metrics item is malformed", async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [{ ran_at: "x" }] });
    await expect(dao.listPollerMetrics()).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("updateRequestStatus", () => {
  it("promotes a DRAFT Request, setting status and location_id", async () => {
    ddbMock.on(GetCommand).resolves({ Item: validRequest });
    ddbMock.on(PutCommand).resolves({});

    const updated = await dao.updateRequestStatus(validRequest.request_id, "PROMOTED", "1234567890");

    expect(updated).toMatchObject({ status: "PROMOTED", location_id: "1234567890" });
    const putInput = ddbMock.commandCalls(PutCommand)[0].args[0].input;
    expect(putInput).toMatchObject({
      ConditionExpression: "status = :expectedStatus",
      ExpressionAttributeValues: { ":expectedStatus": "DRAFT" },
      Item: expect.objectContaining({ status: "PROMOTED", gsi2pk: "PROMOTED", gsi3pk: "1234567890" }),
    });
  });

  it("rejects a DRAFT Request without touching location_id when none is given", async () => {
    ddbMock.on(GetCommand).resolves({ Item: validRequest });
    ddbMock.on(PutCommand).resolves({});

    const updated = await dao.updateRequestStatus(validRequest.request_id, "FILTERED");

    expect(updated).toMatchObject({ status: "FILTERED", location_id: null });
  });

  it("throws ValidationError when the Request doesn't exist", async () => {
    ddbMock.on(GetCommand).resolves({});
    await expect(dao.updateRequestStatus("missing", "PROMOTED", "1234567890")).rejects.toBeInstanceOf(
      ValidationError
    );
    expect(ddbMock.commandCalls(PutCommand)).toHaveLength(0);
  });

  it("throws TerminalError when the Request is no longer DRAFT (already evaluated, e.g. a redelivered SQS message)", async () => {
    ddbMock.on(GetCommand).resolves({ Item: { ...validRequest, status: "PROMOTED" } });
    ddbMock
      .on(PutCommand)
      .rejects(new ConditionalCheckFailedException({ message: "check failed", $metadata: {} }));

    await expect(dao.updateRequestStatus(validRequest.request_id, "PROMOTED", "1234567890")).rejects.toBeInstanceOf(
      TerminalError
    );
  });
});
