import { ConditionalCheckFailedException, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocationDao } from "../../../dao/location/locationDao";
import type { Location } from "../../../models/location";

const TABLE_NAME = "Locations";
const ddbMock = mockClient(DynamoDBDocumentClient);
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const locationDao = new LocationDao(client, TABLE_NAME);

const location: Location = {
  location_id: "1234567890",
  bbl: "1234567890",
  address: "123 Main St",
  borough: "QUEENS",
  community_board: "07 QUEENS",
  zip: "11355",
  latitude: "40.75",
  longitude: "-73.82",
  created_at: "2026-08-20T00:00:00.000Z",
};

beforeEach(() => {
  ddbMock.reset();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("LocationDao.findOrCreateLocation", () => {
  it("returns the existing Location when one is already stored under this bbl", async () => {
    ddbMock.on(GetCommand).resolves({ Item: location });

    await expect(locationDao.findOrCreateLocation(location)).resolves.toEqual(location);
    expect(ddbMock.commandCalls(PutCommand)).toHaveLength(0);
  });

  it("creates the Location when none exists yet", async () => {
    ddbMock.on(GetCommand).resolves({});
    ddbMock.on(PutCommand).resolves({});

    await expect(locationDao.findOrCreateLocation(location)).resolves.toEqual(location);
    const putInput = ddbMock.commandCalls(PutCommand)[0].args[0].input;
    expect(putInput).toMatchObject({
      TableName: TABLE_NAME,
      Item: location,
      ConditionExpression: "attribute_not_exists(location_id)",
    });
  });

  it("re-fetches and returns the winner's version when it loses the dedup-by-bbl race", async () => {
    ddbMock.on(GetCommand).resolvesOnce({}).resolvesOnce({ Item: location });
    ddbMock
      .on(PutCommand)
      .rejects(new ConditionalCheckFailedException({ message: "check failed", $metadata: {} }));

    await expect(locationDao.findOrCreateLocation(location)).resolves.toEqual(location);
    expect(ddbMock.commandCalls(GetCommand)).toHaveLength(2);
  });

  it("rethrows any other error from the create attempt", async () => {
    ddbMock.on(GetCommand).resolves({});
    const boom = new Error("network blip");
    ddbMock.on(PutCommand).rejects(boom);

    await expect(locationDao.findOrCreateLocation(location)).rejects.toBe(boom);
  });
});

describe("LocationDao.getLocation", () => {
  it("returns the validated Location when found", async () => {
    ddbMock.on(GetCommand).resolves({ Item: location });

    await expect(locationDao.getLocation("1234567890")).resolves.toEqual(location);
  });

  it("returns null when no Location exists at this id", async () => {
    ddbMock.on(GetCommand).resolves({});

    await expect(locationDao.getLocation("1234567890")).resolves.toBeNull();
  });
});
