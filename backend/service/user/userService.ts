import { ulid } from "ulid";
import { logInfo } from "../../logger";
import type { UserDao } from "../../dao/user/userDao";
import { getUserDao } from "../../dao/user/getUserDao";
import type { User } from "../../models/user";

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
  const userDao = deps.userDao ?? getUserDao();
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
