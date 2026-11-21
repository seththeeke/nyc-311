import { createDocumentClient } from "../../dynamoClient";
import { requireEnv } from "../../env";
import { ResidentDao } from "./residentDao";

/**
 * Builds a fresh `ResidentDao` on every call, reading `RESIDENTS_TABLE_NAME`
 * only then: the one place that names this table's env var for this DAO
 * (CLAUDE.md §5.2: lazy, never module scope).
 */
export function getResidentDao(): ResidentDao {
  return new ResidentDao(createDocumentClient(), requireEnv("RESIDENTS_TABLE_NAME"));
}
