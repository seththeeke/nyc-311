import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, QueryCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OperatorDao } from "../../../dao/operator/operatorDao";
import { ValidationError } from "../../../models/errors";
import { HOME_DEPOT_LOCATION } from "../../../models/gpsLocation";

const TABLE_NAME = "Operators";
const ddbMock = mockClient(DynamoDBDocumentClient);
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const operatorDao = new OperatorDao(client, TABLE_NAME);

function makeOperatorItem(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    operator_id: "01OPERATOR",
    sk: "#METADATA",
    name: "Truck 12",
    status: "ACTIVE",
    current_activity: "IDLE",
    removal_requested_at: null,
    start_datetime: "2026-09-12T00:00:00.000Z",
    end_datetime: null,
    rate_per_hour: 45,
    current_location: HOME_DEPOT_LOCATION,
    last_event_sequence: 0,
    ...overrides,
  };
}

beforeEach(() => {
  ddbMock.reset();
  ddbMock.on(GetCommand).resolves({});
  ddbMock.on(TransactWriteCommand).resolves({});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("OperatorDao.addOperator", () => {
  it("creates an Operator in its first state: ACTIVE, IDLE, no removal requested", async () => {
    const operator = await operatorDao.addOperator("Truck 12", 45);

    expect(operator).toMatchObject({
      name: "Truck 12",
      status: "ACTIVE",
      current_activity: "IDLE",
      removal_requested_at: null,
      end_datetime: null,
      rate_per_hour: 45,
      current_location: HOME_DEPOT_LOCATION,
      last_event_sequence: 0,
    });
    expect(operator.operator_id.length).toBeGreaterThan(0);
  });

  it("writes an OPERATOR_ADDED event carrying name, rate_per_hour, and the home-depot GPS ping", async () => {
    await operatorDao.addOperator("Truck 12", 45);

    const transactInput = ddbMock.commandCalls(TransactWriteCommand)[0].args[0].input;
    expect(transactInput.TransactItems?.[0]?.Put?.Item).toMatchObject({
      event_type: "OPERATOR_ADDED",
      payload: { name: "Truck 12", rate_per_hour: 45, location: HOME_DEPOT_LOCATION },
    });
  });

  it("stamps gsi1pk/gsi1sk (available) and gsi2pk/gsi2sk (roster) on the projection item", async () => {
    await operatorDao.addOperator("Truck 12", 45);

    const transactInput = ddbMock.commandCalls(TransactWriteCommand)[0].args[0].input;
    const projectionItem = transactInput.TransactItems?.[1]?.Put?.Item as Record<string, unknown>;
    expect(projectionItem.gsi1pk).toBe("AVAILABLE");
    expect(projectionItem.gsi1sk).toBe(projectionItem.start_datetime);
    expect(projectionItem.gsi2pk).toBe("OPERATOR");
    expect(projectionItem.gsi2sk).toBe(`ACTIVE#${projectionItem.start_datetime}`);
  });
});

describe("OperatorDao.getOperator", () => {
  it("returns the validated Operator when found", async () => {
    ddbMock.on(GetCommand).resolves({ Item: makeOperatorItem() });

    await expect(operatorDao.getOperator("01OPERATOR")).resolves.toMatchObject({ operator_id: "01OPERATOR" });
  });

  it("returns null when no projection exists", async () => {
    ddbMock.on(GetCommand).resolves({});

    await expect(operatorDao.getOperator("01OPERATOR")).resolves.toBeNull();
  });
});

describe("OperatorDao.queueRemoval", () => {
  it("sets removal_requested_at, leaving current_activity untouched", async () => {
    ddbMock.on(GetCommand).resolves({ Item: makeOperatorItem({ current_activity: "WORKING" }) });

    const operator = await operatorDao.queueRemoval("01OPERATOR");

    expect(operator.removal_requested_at).not.toBeNull();
    expect(operator.current_activity).toBe("WORKING");
    expect(operator.status).toBe("ACTIVE");
  });

  it("writes an OPERATOR_REMOVAL_REQUESTED event", async () => {
    ddbMock.on(GetCommand).resolves({ Item: makeOperatorItem({ current_activity: "WORKING" }) });

    await operatorDao.queueRemoval("01OPERATOR");

    const transactInput = ddbMock.commandCalls(TransactWriteCommand)[0].args[0].input;
    expect(transactInput.TransactItems?.[0]?.Put?.Item).toMatchObject({ event_type: "OPERATOR_REMOVAL_REQUESTED" });
  });

  it("clears gsi1pk/gsi1sk (no longer available) but keeps gsi2 roster keys", async () => {
    ddbMock.on(GetCommand).resolves({ Item: makeOperatorItem({ current_activity: "WORKING" }) });

    await operatorDao.queueRemoval("01OPERATOR");

    const transactInput = ddbMock.commandCalls(TransactWriteCommand)[0].args[0].input;
    const projectionItem = transactInput.TransactItems?.[1]?.Put?.Item as Record<string, unknown>;
    expect(projectionItem.gsi1pk).toBeUndefined();
    expect(projectionItem.gsi2pk).toBe("OPERATOR");
  });

  it("throws ValidationError when no projection exists yet", async () => {
    ddbMock.on(GetCommand).resolves({});

    await expect(operatorDao.queueRemoval("01OPERATOR")).rejects.toThrow(ValidationError);
  });
});

describe("OperatorDao.finalizeRemoval", () => {
  it("sets status to INACTIVE and stamps end_datetime", async () => {
    ddbMock.on(GetCommand).resolves({ Item: makeOperatorItem() });

    const operator = await operatorDao.finalizeRemoval("01OPERATOR");

    expect(operator.status).toBe("INACTIVE");
    expect(operator.end_datetime).not.toBeNull();
  });

  it("writes an OPERATOR_REMOVED event", async () => {
    ddbMock.on(GetCommand).resolves({ Item: makeOperatorItem() });

    await operatorDao.finalizeRemoval("01OPERATOR");

    const transactInput = ddbMock.commandCalls(TransactWriteCommand)[0].args[0].input;
    expect(transactInput.TransactItems?.[0]?.Put?.Item).toMatchObject({ event_type: "OPERATOR_REMOVED" });
  });

  it("clears gsi1pk (never available again) and re-stamps gsi2sk under INACTIVE", async () => {
    ddbMock.on(GetCommand).resolves({ Item: makeOperatorItem() });

    await operatorDao.finalizeRemoval("01OPERATOR");

    const transactInput = ddbMock.commandCalls(TransactWriteCommand)[0].args[0].input;
    const projectionItem = transactInput.TransactItems?.[1]?.Put?.Item as Record<string, unknown>;
    expect(projectionItem.gsi1pk).toBeUndefined();
    expect(projectionItem.gsi2sk).toBe(`INACTIVE#${projectionItem.start_datetime}`);
  });

  it("throws ValidationError when no projection exists yet", async () => {
    ddbMock.on(GetCommand).resolves({});

    await expect(operatorDao.finalizeRemoval("01OPERATOR")).rejects.toThrow(ValidationError);
  });
});

describe("OperatorDao.findIdleOperator", () => {
  it("queries gsi1-availability, oldest-first, limit 1", async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [makeOperatorItem()] });

    const operator = await operatorDao.findIdleOperator();

    expect(operator).toMatchObject({ operator_id: "01OPERATOR" });
    const queryInput = ddbMock.commandCalls(QueryCommand)[0].args[0].input;
    expect(queryInput).toMatchObject({
      TableName: TABLE_NAME,
      IndexName: "gsi1-availability",
      KeyConditionExpression: "gsi1pk = :pk",
      ExpressionAttributeValues: { ":pk": "AVAILABLE" },
      ScanIndexForward: true,
      Limit: 1,
    });
  });

  it("returns null when no Operator is idle", async () => {
    ddbMock.on(QueryCommand).resolves({});

    await expect(operatorDao.findIdleOperator()).resolves.toBeNull();
  });
});

describe("OperatorDao.startTransit", () => {
  it("sets current_activity to TRANSIT and clears availability", async () => {
    ddbMock.on(GetCommand).resolves({ Item: makeOperatorItem() });

    const operator = await operatorDao.startTransit("01OPERATOR");

    expect(operator.current_activity).toBe("TRANSIT");
    const transactInput = ddbMock.commandCalls(TransactWriteCommand)[0].args[0].input;
    const projectionItem = transactInput.TransactItems?.[1]?.Put?.Item as Record<string, unknown>;
    expect(projectionItem.gsi1pk).toBeUndefined();
  });

  it("writes a TRANSIT_STARTED event carrying the Operator's last known GPS position", async () => {
    ddbMock.on(GetCommand).resolves({ Item: makeOperatorItem() });

    await operatorDao.startTransit("01OPERATOR");

    const transactInput = ddbMock.commandCalls(TransactWriteCommand)[0].args[0].input;
    expect(transactInput.TransactItems?.[0]?.Put?.Item).toMatchObject({
      event_type: "TRANSIT_STARTED",
      payload: { location: HOME_DEPOT_LOCATION },
    });
  });

  it("throws ValidationError when no projection exists yet", async () => {
    ddbMock.on(GetCommand).resolves({});

    await expect(operatorDao.startTransit("01OPERATOR")).rejects.toThrow(ValidationError);
  });
});

describe("OperatorDao.startWork", () => {
  const jobLocation = { lat: 40.75, lng: -73.98 };

  it("sets current_activity to WORKING and updates current_location to the job site", async () => {
    ddbMock.on(GetCommand).resolves({ Item: makeOperatorItem({ current_activity: "TRANSIT" }) });

    const operator = await operatorDao.startWork("01OPERATOR", jobLocation);

    expect(operator.current_activity).toBe("WORKING");
    expect(operator.current_location).toEqual(jobLocation);
  });

  it("writes a WORK_STARTED event carrying the job-site GPS position", async () => {
    ddbMock.on(GetCommand).resolves({ Item: makeOperatorItem({ current_activity: "TRANSIT" }) });

    await operatorDao.startWork("01OPERATOR", jobLocation);

    const transactInput = ddbMock.commandCalls(TransactWriteCommand)[0].args[0].input;
    expect(transactInput.TransactItems?.[0]?.Put?.Item).toMatchObject({
      event_type: "WORK_STARTED",
      payload: { location: jobLocation },
    });
  });

  it("throws ValidationError when no projection exists yet", async () => {
    ddbMock.on(GetCommand).resolves({});

    await expect(operatorDao.startWork("01OPERATOR", jobLocation)).rejects.toThrow(ValidationError);
  });
});

describe("OperatorDao.completeWork", () => {
  it("returns to IDLE, back in the availability queue, GPS position unchanged", async () => {
    const jobLocation = { lat: 40.75, lng: -73.98 };
    ddbMock
      .on(GetCommand)
      .resolves({ Item: makeOperatorItem({ current_activity: "WORKING", current_location: jobLocation }) });

    const operator = await operatorDao.completeWork("01OPERATOR");

    expect(operator.current_activity).toBe("IDLE");
    expect(operator.current_location).toEqual(jobLocation);
    const transactInput = ddbMock.commandCalls(TransactWriteCommand)[0].args[0].input;
    const projectionItem = transactInput.TransactItems?.[1]?.Put?.Item as Record<string, unknown>;
    expect(projectionItem.gsi1pk).toBe("AVAILABLE");
  });

  it("writes a WORK_COMPLETED event carrying the Operator's current GPS position", async () => {
    const jobLocation = { lat: 40.75, lng: -73.98 };
    ddbMock
      .on(GetCommand)
      .resolves({ Item: makeOperatorItem({ current_activity: "WORKING", current_location: jobLocation }) });

    await operatorDao.completeWork("01OPERATOR");

    const transactInput = ddbMock.commandCalls(TransactWriteCommand)[0].args[0].input;
    expect(transactInput.TransactItems?.[0]?.Put?.Item).toMatchObject({
      event_type: "WORK_COMPLETED",
      payload: { location: jobLocation },
    });
  });

  it("stays out of the availability queue when a removal is already queued", async () => {
    ddbMock.on(GetCommand).resolves({
      Item: makeOperatorItem({ current_activity: "WORKING", removal_requested_at: "2026-09-12T01:00:00.000Z" }),
    });

    await operatorDao.completeWork("01OPERATOR");

    const transactInput = ddbMock.commandCalls(TransactWriteCommand)[0].args[0].input;
    const projectionItem = transactInput.TransactItems?.[1]?.Put?.Item as Record<string, unknown>;
    expect(projectionItem.gsi1pk).toBeUndefined();
  });

  it("throws ValidationError when no projection exists yet", async () => {
    ddbMock.on(GetCommand).resolves({});

    await expect(operatorDao.completeWork("01OPERATOR")).rejects.toThrow(ValidationError);
  });
});

describe("OperatorDao.listActiveRoster", () => {
  it("queries gsi2-roster for the ACTIVE# prefix and returns validated Operators", async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [makeOperatorItem()] });

    const roster = await operatorDao.listActiveRoster();

    expect(roster).toHaveLength(1);
    expect(roster[0]).toMatchObject({ operator_id: "01OPERATOR", status: "ACTIVE" });
    const queryInput = ddbMock.commandCalls(QueryCommand)[0].args[0].input;
    expect(queryInput).toMatchObject({
      TableName: TABLE_NAME,
      IndexName: "gsi2-roster",
      KeyConditionExpression: "gsi2pk = :pk AND begins_with(gsi2sk, :statusPrefix)",
      ExpressionAttributeValues: { ":pk": "OPERATOR", ":statusPrefix": "ACTIVE#" },
    });
  });

  it("returns an empty array when no active Operators exist", async () => {
    ddbMock.on(QueryCommand).resolves({});

    await expect(operatorDao.listActiveRoster()).resolves.toEqual([]);
  });

  it("throws ValidationError when a roster item fails schema validation", async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [{ operator_id: "01OPERATOR" }] });

    await expect(operatorDao.listActiveRoster()).rejects.toThrow(ValidationError);
  });
});
