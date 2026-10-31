import { logInfo } from "../../../logger";
import type { PublicApiResult, PublicCallContext } from "../../../models/publicApi/publicApiCall";
import { getOpenApiSpec } from "../../../service/publicApi/publicApiService";
import { NO_USAGE } from "./publicApiResponse";

/** `GET /v1/openapi.yaml` (16-resident-action-models.md §2.5): the spec, served by the API it describes. */
export const getOpenApiSpecController = async (event: unknown, context: PublicCallContext): Promise<PublicApiResult> => {
  logInfo("GetOpenApiSpecControllerInvoked", { callId: context.call_id, requester: context.requester, event });
  const spec = await getOpenApiSpec();
  const result: PublicApiResult = { status_code: 200, body: spec, content_type: "application/yaml", usage: NO_USAGE };
  logInfo("GetOpenApiSpecControllerCompleted", { callId: context.call_id, statusCode: result.status_code, bytes: spec.length });
  return result;
};
