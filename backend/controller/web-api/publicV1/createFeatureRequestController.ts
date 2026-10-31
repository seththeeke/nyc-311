import { logError, logInfo } from "../../../logger";
import { ApiGatewayHttpEventSchema } from "../../../models/apiGatewayHttpEvent";
import { CreateFeatureRequestBodySchema, FEATURE_REQUEST_MAX_BODY_BYTES } from "../../../models/publicApi/featureRequest";
import type { PublicApiResult, PublicCallContext } from "../../../models/publicApi/publicApiCall";
import { IdempotencyKeySchema } from "../../../models/publicApi/publicApiPrimitives";
import { createFeatureRequest } from "../../../service/publicApi/publicApiService";
import { issuesToDetails, publicError, publicResult } from "./publicApiResponse";

/** `POST /v1/feature-requests` (16-resident-action-models.md §2.4.2). Free text never reaches the usage row. */
export const createFeatureRequestController = async (event: unknown, context: PublicCallContext): Promise<PublicApiResult> => {
  logInfo("CreateFeatureRequestControllerInvoked", { callId: context.call_id, requester: context.requester, event });

  const parsedEvent = ApiGatewayHttpEventSchema.parse(event);
  const rawBody = parsedEvent.body ?? "";
  if (Buffer.byteLength(rawBody, "utf8") > FEATURE_REQUEST_MAX_BODY_BYTES) {
    return publicError(400, "VALIDATION_ERROR", "The request body is too large.", [{ field: "body", issue: "must be at most 8 KB" }]);
  }

  const rawKey = parsedEvent.headers?.["idempotency-key"];
  const key = rawKey === undefined ? null : IdempotencyKeySchema.safeParse(rawKey);
  if (key && !key.success) {
    return publicError(400, "VALIDATION_ERROR", "The Idempotency-Key header is malformed.", [
      { field: "Idempotency-Key", issue: "must be 8-128 characters of A-Z, a-z, 0-9, _ or -" },
    ]);
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return publicError(400, "VALIDATION_ERROR", "The request body must be JSON.", [{ field: "body", issue: "is not valid JSON" }]);
  }
  const parsedBody = CreateFeatureRequestBodySchema.safeParse(json);
  if (!parsedBody.success) {
    logError("CreateFeatureRequestControllerValidationFailed", { callId: context.call_id, issues: parsedBody.error.issues });
    return publicError(400, "VALIDATION_ERROR", "The request body is invalid.", issuesToDetails(parsedBody.error.issues));
  }

  const featureRequest = await createFeatureRequest(parsedBody.data, key ? key.data : null);
  const result = publicResult(201, featureRequest, { request_params: null, result_count: null, resource_id: featureRequest.feature_request_id });
  logInfo("CreateFeatureRequestControllerCompleted", { callId: context.call_id, featureRequestId: featureRequest.feature_request_id });
  return result;
};
