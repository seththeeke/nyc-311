import { logError, logInfo } from "../../../logger";
import { ApiGatewayHttpEventSchema } from "../../../models/apiGatewayHttpEvent";
import { ValidationError } from "../../../models/errors";
import { PublicApiErrorDetailSchema } from "../../../models/publicApi/publicApiError";
import type { PublicApiResult, PublicCallContext } from "../../../models/publicApi/publicApiCall";
import { SearchRequestsBodySchema } from "../../../models/publicApi/searchRequests";
import { searchRequests } from "../../../service/publicApi/publicApiService";
import { issuesToDetails, publicError, publicResult } from "./publicApiResponse";

/** `POST /v1/requests/search` (16-resident-action-models.md §2.4.1). */
export const searchRequestsController = async (event: unknown, context: PublicCallContext): Promise<PublicApiResult> => {
  logInfo("SearchRequestsControllerInvoked", { callId: context.call_id, requester: context.requester, event });

  const parsedEvent = ApiGatewayHttpEventSchema.parse(event);
  let json: unknown;
  try {
    json = JSON.parse(parsedEvent.body ?? "");
  } catch {
    return publicError(400, "VALIDATION_ERROR", "The request body must be JSON.", [{ field: "body", issue: "is not valid JSON" }]);
  }
  const parsedBody = SearchRequestsBodySchema.safeParse(json);
  if (!parsedBody.success) {
    logError("SearchRequestsControllerValidationFailed", { callId: context.call_id, issues: parsedBody.error.issues });
    return publicError(400, "VALIDATION_ERROR", "The request body is invalid.", issuesToDetails(parsedBody.error.issues));
  }

  const requestParams = `order_id=${parsedBody.data.search_params.order_id}`;
  try {
    const response = await searchRequests(parsedBody.data);
    const result = publicResult(200, response, { request_params: requestParams, result_count: response.items.length, resource_id: null });
    logInfo("SearchRequestsControllerCompleted", { callId: context.call_id, resultCount: response.items.length });
    return result;
  } catch (err) {
    if (err instanceof ValidationError) {
      const details = PublicApiErrorDetailSchema.array().safeParse(err.details);
      return publicError(400, "VALIDATION_ERROR", err.message, details.success ? details.data : undefined, {
        request_params: requestParams,
        result_count: null,
        resource_id: null,
      });
    }
    throw err;
  }
};
