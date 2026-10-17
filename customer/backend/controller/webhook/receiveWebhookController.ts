import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { logError, logInfo } from "../../logger";
import { ApiGatewayHttpEventSchema } from "../../models/apiGatewayHttpEvent";
import { UnauthorizedError, ValidationError } from "../../models/errors";
import { receiveBoroughSimWebhook } from "../../service/webhook/webhookReceiverService";

const JSON_HEADERS = { "Content-Type": "application/json" };

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(body) };
}

/**
 * `POST /webhooks/bureau` — where BoroughSim delivers lifecycle events
 * (docs/13-customer-simulation.md §3 Flow A). `200` once the delivery is
 * verified and applied, including a repeat; `401` for a bad signature;
 * `400` for an unreadable body. Anything but `2xx` makes BoroughSim retry.
 */
export const receiveWebhookController = async (event: unknown): Promise<APIGatewayProxyStructuredResultV2> => {
  logInfo("ReceiveWebhookControllerInvoked", { event });

  const parsed = ApiGatewayHttpEventSchema.safeParse(event);
  if (!parsed.success) {
    logError("ReceiveWebhookControllerValidationFailed", { issues: parsed.error.issues });
    return jsonResponse(400, { message: "Malformed request" });
  }

  try {
    const outcome = await receiveBoroughSimWebhook(parsed.data.headers ?? {}, parsed.data.body ?? "");
    const response = jsonResponse(200, { received: true, outcome });
    logInfo("ReceiveWebhookControllerCompleted", { response });
    return response;
  } catch (err) {
    logError("ReceiveWebhookControllerFailed", { error: err instanceof Error ? err.message : err });
    if (err instanceof UnauthorizedError) return jsonResponse(401, { message: err.message });
    if (err instanceof ValidationError) return jsonResponse(400, { message: err.message });
    return jsonResponse(500, { message: "Failed to process webhook" });
  }
};
