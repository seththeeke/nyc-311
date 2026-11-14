import { createDocumentClient } from "../../dynamoClient";
import { requireEnv } from "../../env";
import { ContactDao } from "./contactDao";

/**
 * Builds a fresh `ContactDao` on every call, reading `CONTACTS_TABLE_NAME`
 * only then: the one place that names this table's env var (§5.2: lazy,
 * never module scope).
 */
export function getContactDao(): ContactDao {
  return new ContactDao(createDocumentClient(), requireEnv("CONTACTS_TABLE_NAME"));
}
