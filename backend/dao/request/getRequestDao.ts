import { createDocumentClient } from "../../dynamoClient";
import { requireEnv } from "../../env";
import { RequestDao } from "./requestDao";

/**
 * Builds a fresh `RequestDao` on every call, reading `REQUESTS_TABLE_NAME`
 * only then: the one place that names this table's env var (§5.2: lazy,
 * never module scope).
 */
export function getRequestDao(): RequestDao {
  return new RequestDao(createDocumentClient(), requireEnv("REQUESTS_TABLE_NAME"));
}
