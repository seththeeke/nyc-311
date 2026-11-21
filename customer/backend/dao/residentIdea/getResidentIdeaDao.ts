import { createDocumentClient } from "../../dynamoClient";
import { requireEnv } from "../../env";
import { ResidentIdeaDao } from "./residentIdeaDao";

/**
 * Builds a fresh `ResidentIdeaDao` on every call. It needs both
 * `RESIDENT_IDEAS_TABLE_NAME` and `RESIDENTS_TABLE_NAME`, read only then
 * (CLAUDE.md §5.2: lazy, never module scope).
 */
export function getResidentIdeaDao(): ResidentIdeaDao {
  return new ResidentIdeaDao(createDocumentClient(), requireEnv("RESIDENT_IDEAS_TABLE_NAME"), requireEnv("RESIDENTS_TABLE_NAME"));
}
