import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { logError, logInfo } from "../../logger";
import { ApiGatewayHttpEventSchema } from "../../models/apiGatewayHttpEvent";
import { ValidationError } from "../../models/errors";
import { receiveSinkDelivery } from "../../service/webhook/webhookSinkService";

const JSON_HEADERS = { "Content-Type": "application/json" };

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(body) };
}

/**
 * `POST /webhook-sink` — the Test-only sink subscriber
 * (`13-customer-simulation.md` §5). `200` for a delivery whose signature
 * verifies, `401` for one that doesn't; either way it is recorded.
 */
export const receiveWebhookSinkController = async (event: unknown): Promise<APIGatewayProxyStructuredResultV2> => {
  logInfo("ReceiveWebhookSinkControllerInvoked", { event });

  const parsed = ApiGatewayHttpEventSchema.safeParse(event);
  if (!parsed.success) {
    logError("ReceiveWebhookSinkControllerValidationFailed", { issues: parsed.error.issues });
    return jsonResponse(400, { message: "Malformed request" });
  }

  try {
    const signatureValid = await receiveSinkDelivery(parsed.data.headers ?? {}, parsed.data.body ?? "");
    const response = signatureValid ? jsonResponse(200, { received: true }) : jsonResponse(401, { message: "Invalid signature" });
    logInfo("ReceiveWebhookSinkControllerCompleted", { response });
    return response;
  } catch (err) {
    logError("ReceiveWebhookSinkControllerFailed", { error: err instanceof Error ? err.message : err });
    if (err instanceof ValidationError) return jsonResponse(400, { message: err.message });
    return jsonResponse(500, { message: "Failed to record webhook delivery" });
  }
};
