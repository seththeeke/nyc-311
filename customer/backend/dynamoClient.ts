/**
 * Shared DynamoDB document client construction — copied from
 * `backend/dynamoClient.ts` (CLAUDE.md §5.4: shared helpers are copied,
 * never imported), which factored this same one-liner out of 19 service
 * files there (#91). Callers still construct their own DAOs lazily per
 * function invocation (CLAUDE.md §5.2); this only removes the repeated
 * SDK-client expression, not the lazy-construction discipline itself.
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

export function createDocumentClient(): DynamoDBDocumentClient {
  return DynamoDBDocumentClient.from(new DynamoDBClient({}));
}
