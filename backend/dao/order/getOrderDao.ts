import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { createDocumentClient } from "../../dynamoClient";
import { requireEnv } from "../../env";
import { OrderDao } from "./orderDao";

/**
 * Builds a fresh `OrderDao` on every call, reading `ORDERS_TABLE_NAME` only
 * then: the one place that names this table's env var (§5.2: lazy, never
 * module scope). Pass `client` to share one client across several DAOs.
 */
export function getOrderDao(client: DynamoDBDocumentClient = createDocumentClient()): OrderDao {
  return new OrderDao(client, requireEnv("ORDERS_TABLE_NAME"));
}
