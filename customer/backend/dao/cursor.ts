import { ValidationError } from "../models/errors";

/*
 * Opaque page cursors (§2 customer side, decision 9): a DynamoDB
 * LastEvaluatedKey, base64url-encoded JSON. Only string-valued keys exist
 * in these tables, so anything else in a decoded cursor is rejected.
 */

export type DynamoKey = Record<string, string>;

export function encodeCursor(key: Record<string, unknown> | undefined): string | null {
  if (!key) return null;
  return Buffer.from(JSON.stringify(key), "utf8").toString("base64url");
}

/** @throws {@link ValidationError} for a cursor that is not one this API issued. */
export function decodeCursor(cursor: string | undefined): DynamoKey | undefined {
  if (cursor === undefined) return undefined;
  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
  } catch {
    throw new ValidationError("Invalid cursor");
  }
  if (typeof decoded !== "object" || decoded === null || Array.isArray(decoded)) throw new ValidationError("Invalid cursor");
  const entries = Object.entries(decoded);
  if (entries.length === 0 || entries.some(([, value]) => typeof value !== "string")) throw new ValidationError("Invalid cursor");
  return Object.fromEntries(entries) as DynamoKey;
}
