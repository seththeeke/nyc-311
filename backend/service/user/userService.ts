import { ulid } from "ulid";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { logInfo } from "../../logger";
import { UserDao } from "../../dao/user/userDao";
import type { User } from "../../models/user";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/* Lazily constructed per CLAUDE.md §5.2 — never a module-scope singleton. */
function getDefaultUserDao(): UserDao {
  return new UserDao(DynamoDBDocumentClient.from(new DynamoDBClient({})), requireEnv("USERS_TABLE_NAME"));
}

/** Dependencies for {@link getOrCreateUser} — defaults to this module's own singleton; tests override it with a mock. */
export interface GetOrCreateUserDeps {
  userDao?: UserDao;
}

/**
 * `9-admin-auth-integration.md` §5 — resolves a Cognito-authenticated
 * request's `sub`/`email` claims to the internal `User` record, creating
 * one on first login. Every authenticated admin controller calls this
 * (via `requireAdminUser`) as its first step, so every admin action has a
 * real `user_id` to attribute.
 */
export async function getOrCreateUser(
  cognitoSub: string,
  email: string,
  deps: GetOrCreateUserDeps = {}
): Promise<User> {
  const userDao = deps.userDao ?? getDefaultUserDao();
  const now = new Date().toISOString();

  const existing = await userDao.getUserByCognitoSub(cognitoSub);
  if (existing) {
    logInfo("GetOrCreateUserFoundExisting", { userId: existing.user_id });
    const updated: User = { ...existing, last_active_at: now };
    await userDao.putUser(updated);
    return updated;
  }

  const created: User = {
    user_id: ulid(),
    type: "ADMIN",
    status: "ACTIVE",
    created_at: now,
    updated_at: now,
    last_active_at: now,
    cognito_sub: cognitoSub,
    email,
    display_name: null,
  };
  logInfo("GetOrCreateUserCreatingNew", { userId: created.user_id, cognitoSub });
  await userDao.putUser(created);
  return created;
}
