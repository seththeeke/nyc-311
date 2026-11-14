import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { createDocumentClient } from "../../dynamoClient";
import { requireEnv } from "../../env";
import { LocationDao } from "./locationDao";

/**
 * Builds a fresh `LocationDao` on every call, reading `LOCATIONS_TABLE_NAME`
 * only then: the one place that names this table's env var (§5.2: lazy,
 * never module scope). Pass `client` to share one client across several DAOs.
 */
export function getLocationDao(client: DynamoDBDocumentClient = createDocumentClient()): LocationDao {
  return new LocationDao(client, requireEnv("LOCATIONS_TABLE_NAME"));
}
