/**
 * Shared DynamoDB document client construction, same top-level pattern as
 * `env.ts`'s `requireEnv()` — a one-liner that 19 `service/` files each
 * defined identically. Callers still construct their own DAOs lazily per
 * function invocation (CLAUDE.md §5.2); this only factors out the repeated
 * SDK client expression, not the lazy-construction discipline itself.
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

export function createDocumentClient(): DynamoDBDocumentClient {
  return DynamoDBDocumentClient.from(new DynamoDBClient({}));
}
