import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { logError, logInfo } from "../../logger";
import { listOrders } from "../../service/order/orderService";
import { ApiGatewayHttpEventSchema } from "../../models/apiGatewayHttpEvent";
import { OrderListQuerySchema } from "../../models/orderListQuery";
import { ValidationError } from "../../models/errors";

const JSON_HEADERS = { "Content-Type": "application/json" };

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(body) };
}

/**
 * `GET /orders` entry point (3-order-ingestion.md's Order list view).
 * Validates the HTTP API v2 event, parses its query string into a typed
 * `OrderListQuery`, delegates to `listOrders`, and maps any failure to an
 * HTTP status code — same shape as `getPollerMetricsController`.
 */
export const getOrdersController = async (event: unknown): Promise<APIGatewayProxyStructuredResultV2> => {
  logInfo("GetOrdersControllerInvoked", { event });

  const parsedEvent = ApiGatewayHttpEventSchema.safeParse(event);
  if (!parsedEvent.success) {
    logError("GetOrdersControllerValidationFailed", { issues: parsedEvent.error.issues });
    return jsonResponse(400, { message: "Malformed request" });
  }

  const parsedQuery = OrderListQuerySchema.safeParse(parsedEvent.data.queryStringParameters ?? {});
  if (!parsedQuery.success) {
    logError("GetOrdersControllerQueryValidationFailed", { issues: parsedQuery.error.issues });
    return jsonResponse(400, { message: "Malformed query parameters" });
  }

  try {
    const result = await listOrders(parsedQuery.data);
    logInfo("GetOrdersControllerCompleted", {
      count: result.orders.length,
      hasNextPage: result.nextCursor !== null,
    });
    return jsonResponse(200, result);
  } catch (err) {
    logError("GetOrdersControllerFailed", { error: err instanceof Error ? err.message : err });
    const statusCode = err instanceof ValidationError ? 400 : 500;
    return jsonResponse(statusCode, { message: "Failed to fetch orders" });
  }
};
