import { logInfo } from "../../../logger";
import { ApiGatewayHttpEventSchema } from "../../../models/apiGatewayHttpEvent";
import { NotFoundError } from "../../../models/errors";
import { FeatureRequestIdParamsSchema } from "../../../models/publicApi/featureRequest";
import type { PublicApiResult, PublicCallContext } from "../../../models/publicApi/publicApiCall";
import { getFeatureRequest } from "../../../service/publicApi/publicApiService";
import { issuesToDetails, publicError, publicResult } from "./publicApiResponse";

/** `GET /v1/feature-requests/{feature_request_id}` (16-resident-action-models.md §2.4.3). */
export const getFeatureRequestController = async (event: unknown, context: PublicCallContext): Promise<PublicApiResult> => {
  logInfo("GetFeatureRequestControllerInvoked", { callId: context.call_id, requester: context.requester, event });

  const parsedEvent = ApiGatewayHttpEventSchema.parse(event);
  const params = FeatureRequestIdParamsSchema.safeParse(parsedEvent.pathParameters ?? {});
  if (!params.success) {
    return publicError(400, "VALIDATION_ERROR", "The feature request id is malformed.", issuesToDetails(params.error.issues, "path"));
  }

  const featureRequestId = params.data.feature_request_id;
  const usage = { request_params: null, result_count: null, resource_id: featureRequestId };
  try {
    const featureRequest = await getFeatureRequest(featureRequestId);
    logInfo("GetFeatureRequestControllerCompleted", { callId: context.call_id, featureRequestId, status: featureRequest.status });
    return publicResult(200, featureRequest, usage);
  } catch (err) {
    if (err instanceof NotFoundError) return publicError(404, "NOT_FOUND", "No feature request has that id.", undefined, usage);
    throw err;
  }
};
