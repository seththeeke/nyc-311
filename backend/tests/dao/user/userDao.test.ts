import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UserDao } from "../../../dao/user/userDao";
import type { User } from "../../../models/user";

const TABLE_NAME = "Users";
const ddbMock = mockClient(DynamoDBDocumentClient);
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const userDao = new UserDao(client, TABLE_NAME);

const user: User = {
  user_id: "01H0000000000000000000001",
  type: "ADMIN",
  status: "ACTIVE",
  created_at: "2026-09-10T00:00:00.000Z",
  updated_at: "2026-09-10T00:00:00.000Z",
  last_active_at: "2026-09-10T00:00:00.000Z",
  cognito_sub: "abc-123",
  email: "admin@example.com",
  display_name: null,
};

beforeEach(() => {
  ddbMock.reset();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("UserDao.getUser", () => {
  it("returns the validated User when found", async () => {
    ddbMock.on(GetCommand).resolves({ Item: user });
    await expect(userDao.getUser(user.user_id)).resolves.toEqual(user);
  });

  it("returns null when no item exists", async () => {
    ddbMock.on(GetCommand).resolves({});
    await expect(userDao.getUser(user.user_id)).resolves.toBeNull();
  });
});

describe("UserDao.getUserByCognitoSub", () => {
  it("queries gsi1-cognito-sub and returns the first match", async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [user] });

    await expect(userDao.getUserByCognitoSub("abc-123")).resolves.toEqual(user);

    const queryInput = ddbMock.commandCalls(QueryCommand)[0].args[0].input;
    expect(queryInput).toMatchObject({
      TableName: TABLE_NAME,
      IndexName: "gsi1-cognito-sub",
      KeyConditionExpression: "gsi1pk = :cognitoSub",
      ExpressionAttributeValues: { ":cognitoSub": "abc-123" },
      Limit: 1,
    });
  });

  it("returns null when no item matches", async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    await expect(userDao.getUserByCognitoSub("no-such-sub")).resolves.toBeNull();
  });

  it("returns null when Items is absent entirely", async () => {
    ddbMock.on(QueryCommand).resolves({});
    await expect(userDao.getUserByCognitoSub("no-such-sub")).resolves.toBeNull();
  });
});

describe("UserDao.putUser", () => {
  it("writes the User with gsi1pk stamped from cognito_sub", async () => {
    ddbMock.on(PutCommand).resolves({});

    await userDao.putUser(user);

    const putInput = ddbMock.commandCalls(PutCommand)[0].args[0].input;
    expect(putInput).toMatchObject({ TableName: TABLE_NAME, Item: { ...user, gsi1pk: user.cognito_sub } });
  });
});
