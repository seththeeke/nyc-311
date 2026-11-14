import { createDocumentClient } from "../../dynamoClient";
import { requireEnv } from "../../env";
import { UserDao } from "./userDao";

/**
 * Builds a fresh `UserDao` on every call, reading `USERS_TABLE_NAME` only
 * then: the one place that names this table's env var (§5.2: lazy, never
 * module scope).
 */
export function getUserDao(): UserDao {
  return new UserDao(createDocumentClient(), requireEnv("USERS_TABLE_NAME"));
}
