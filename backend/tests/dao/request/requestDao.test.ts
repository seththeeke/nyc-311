import { ConditionalCheckFailedException, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RequestDao } from "../../../dao/request/requestDao";
import { ValidationError } from "../../../models/errors";
import type { Request } from "../../../models/request";

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
