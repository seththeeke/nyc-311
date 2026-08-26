import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { logError, logInfo } from "../../logger";
import { listOrderEvents } from "../../service/order/orderService";
import { ApiGatewayHttpEventSchema } from "../../models/apiGatewayHttpEvent";
import { OrderEventListQuerySchema } from "../../models/orderEventListQuery";
import { ValidationError } from "../../models/errors";

const JSON_HEADERS = { "Content-Type": "application/json" };

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(body) };
}

/**
 * `GET /order-events` entry point (`5-order-evaluation.md`'s Order Events
 * list view). Validates the HTTP API v2 event, parses its query string
 * into a typed `OrderEventListQuery`, delegates to `listOrderEvents`, and
 * maps any failure to an HTTP status code — same shape as
 * `getOrdersController`.
 */
export const getOrderEventsController = async (event: unknown): Promise<APIGatewayProxyStructuredResultV2> => {
  logInfo("GetOrderEventsControllerInvoked", { event });

  const parsedEvent = ApiGatewayHttpEventSchema.safeParse(event);
  if (!parsedEvent.success) {
    logError("GetOrderEventsControllerValidationFailed", { issues: parsedEvent.error.issues });
    return jsonResponse(400, { message: "Malformed request" });
  }

  const parsedQuery = OrderEventListQuerySchema.safeParse(parsedEvent.data.queryStringParameters ?? {});
  if (!parsedQuery.success) {
    logError("GetOrderEventsControllerQueryValidationFailed", { issues: parsedQuery.error.issues });
    return jsonResponse(400, { message: "Malformed query parameters" });
  }

  try {
    const result = await listOrderEvents(parsedQuery.data);
    logInfo("GetOrderEventsControllerCompleted", {
      count: result.events.length,
      hasNextPage: result.nextCursor !== null,
    });
    return jsonResponse(200, result);
  } catch (err) {
    logError("GetOrderEventsControllerFailed", { error: err instanceof Error ? err.message : err });
    const statusCode = err instanceof ValidationError ? 400 : 500;
    return jsonResponse(statusCode, { message: "Failed to fetch order events" });
  }
};
