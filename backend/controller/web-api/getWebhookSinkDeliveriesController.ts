import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { logError, logInfo } from "../../logger";
import { ApiGatewayHttpEventSchema } from "../../models/apiGatewayHttpEvent";
import { listSinkDeliveries } from "../../service/webhook/webhookSinkService";

const JSON_HEADERS = { "Content-Type": "application/json" };

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(body) };
}

/**
 * `GET /webhook-sink/deliveries` — the Test-only sink's most recent
 * deliveries, newest first (`13-customer-simulation.md` §5). Public and
 * read-only; what the integration suite asserts against.
 */
export const getWebhookSinkDeliveriesController = async (event: unknown): Promise<APIGatewayProxyStructuredResultV2> => {
  logInfo("GetWebhookSinkDeliveriesControllerInvoked", { event });

  const parsed = ApiGatewayHttpEventSchema.safeParse(event);
  if (!parsed.success) {
    logError("GetWebhookSinkDeliveriesControllerValidationFailed", { issues: parsed.error.issues });
    return jsonResponse(400, { message: "Malformed request" });
  }

  try {
    const deliveries = await listSinkDeliveries();
    const response = jsonResponse(200, { deliveries });
    logInfo("GetWebhookSinkDeliveriesControllerCompleted", { count: deliveries.length });
    return response;
  } catch (err) {
    logError("GetWebhookSinkDeliveriesControllerFailed", { error: err instanceof Error ? err.message : err });
    return jsonResponse(500, { message: "Failed to list webhook sink deliveries" });
  }
};
