import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UserDao } from "../../../dao/user/userDao";
import { getOrCreateUser } from "../../../service/user/userService";
import type { User } from "../../../models/user";

const TABLE_NAME = "Users";
const ddbMock = mockClient(DynamoDBDocumentClient);
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const userDao = new UserDao(client, TABLE_NAME);

const existingUser: User = {
  user_id: "01H0000000000000000000001",
  type: "ADMIN",
  status: "ACTIVE",
  created_at: "2026-09-01T00:00:00.000Z",
  updated_at: "2026-09-01T00:00:00.000Z",
  last_active_at: "2026-09-01T00:00:00.000Z",
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

describe("getOrCreateUser", () => {
  it("falls back to the module's own default UserDao when deps.userDao is omitted", async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    ddbMock.on(PutCommand).resolves({});

    const user = await getOrCreateUser("new-sub", "new@example.com");

    expect(user.cognito_sub).toBe("new-sub");
  });

  it("bumps last_active_at and re-persists an existing User", async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [existingUser] });
    ddbMock.on(PutCommand).resolves({});

    const result = await getOrCreateUser("abc-123", "admin@example.com", { userDao });

    expect(result.user_id).toBe(existingUser.user_id);
    expect(result.last_active_at).not.toBe(existingUser.last_active_at);
    const putInput = ddbMock.commandCalls(PutCommand)[0].args[0].input;
    expect(putInput?.Item).toMatchObject({ user_id: existingUser.user_id, cognito_sub: "abc-123" });
  });

  it("creates a new User when none exists for this cognito_sub", async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    ddbMock.on(PutCommand).resolves({});

    const result = await getOrCreateUser("brand-new-sub", "brand-new@example.com", { userDao });

    expect(result.type).toBe("ADMIN");
    expect(result.status).toBe("ACTIVE");
    expect(result.cognito_sub).toBe("brand-new-sub");
    expect(result.email).toBe("brand-new@example.com");
    expect(result.display_name).toBeNull();
    const putInput = ddbMock.commandCalls(PutCommand)[0].args[0].input;
    expect(putInput?.Item).toMatchObject({ cognito_sub: "brand-new-sub" });
  });
});

describe("module wiring", () => {
  it("does not throw on import when USERS_TABLE_NAME is unset (lazy construction, CLAUDE.md §5.2)", async () => {
    const previous = process.env.USERS_TABLE_NAME;
    delete process.env.USERS_TABLE_NAME;
    vi.resetModules();

    await expect(import("../../../service/user/userService.js")).resolves.toBeDefined();

    process.env.USERS_TABLE_NAME = previous;
    vi.resetModules();
  });

  it("throws only when getOrCreateUser is actually called without deps.userDao and the env var is unset", async () => {
    const previous = process.env.USERS_TABLE_NAME;
    delete process.env.USERS_TABLE_NAME;
    vi.resetModules();
    const { getOrCreateUser: freshGetOrCreateUser } = await import("../../../service/user/userService.js");

    await expect(freshGetOrCreateUser("sub", "email@example.com")).rejects.toThrow(
      "Missing required environment variable: USERS_TABLE_NAME"
    );

    process.env.USERS_TABLE_NAME = previous;
    vi.resetModules();
  });
});
