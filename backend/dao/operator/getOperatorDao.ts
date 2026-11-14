import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { createDocumentClient } from "../../dynamoClient";
import { requireEnv } from "../../env";
import { OperatorDao } from "./operatorDao";

/**
 * Builds a fresh `OperatorDao` on every call, reading `OPERATORS_TABLE_NAME`
 * only then: the one place that names this table's env var (§5.2: lazy,
 * never module scope). Pass `client` to share one client across several DAOs.
 */
export function getOperatorDao(client: DynamoDBDocumentClient = createDocumentClient()): OperatorDao {
  return new OperatorDao(client, requireEnv("OPERATORS_TABLE_NAME"));
}
