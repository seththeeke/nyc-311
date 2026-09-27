import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { logError, logInfo } from "../../logger";
import { ApiGatewayHttpEventSchema } from "../../models/apiGatewayHttpEvent";
import { NotFoundError } from "../../models/errors";
import { FlagKeyParamsSchema, TreatmentRequestSchema, type TreatmentResponse } from "../../models/featureFlag";
import { evaluateFeatureFlag } from "../../service/featureFlag/featureFlagService";

const JSON_HEADERS = { "Content-Type": "application/json" };

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(body) };
}

/**
 * `POST /feature-flags/{flag_key}/treatment` (`11-street-condition-implementation.md`
 * §4.2/§4.3) — public. Chooses a treatment for the given context; a
 * missing flag is a `404` here (only in-process callers get a fallback).
 */
export const getTreatmentController = async (event: unknown): Promise<APIGatewayProxyStructuredResultV2> => {
  logInfo("GetTreatmentControllerInvoked", { event });

  const parsedEvent = ApiGatewayHttpEventSchema.safeParse(event);
  if (!parsedEvent.success) {
    logError("GetTreatmentControllerValidationFailed", { issues: parsedEvent.error.issues });
    return jsonResponse(400, { message: "Malformed request" });
  }

  const parsedParams = FlagKeyParamsSchema.safeParse(parsedEvent.data.pathParameters ?? {});
  if (!parsedParams.success) {
    logError("GetTreatmentControllerParamsValidationFailed", { issues: parsedParams.error.issues });
    return jsonResponse(400, { message: "Missing or malformed flag_key path parameter" });
  }

  let rawBody: unknown = {};
  if (parsedEvent.data.body) {
    try {
      rawBody = JSON.parse(parsedEvent.data.body);
    } catch {
      logError("GetTreatmentControllerBodyParseFailed", {});
      return jsonResponse(400, { message: "Malformed JSON body" });
    }
  }
  const parsedBody = TreatmentRequestSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    logError("GetTreatmentControllerBodyValidationFailed", { issues: parsedBody.error.issues });
    return jsonResponse(400, { message: "Malformed request body", issues: parsedBody.error.issues });
  }

  const { flag_key: flagKey } = parsedParams.data;
  try {
    const treatment = await evaluateFeatureFlag(flagKey, parsedBody.data.context);
    const body: TreatmentResponse = { flag_key: flagKey, treatment };
    const response = jsonResponse(200, body);
    logInfo("GetTreatmentControllerCompleted", { response });
    return response;
  } catch (err) {
    logError("GetTreatmentControllerFailed", { flagKey, error: err instanceof Error ? err.message : err });
    if (err instanceof NotFoundError) return jsonResponse(404, { message: err.message });
    return jsonResponse(500, { message: "Failed to evaluate treatment" });
  }
};
