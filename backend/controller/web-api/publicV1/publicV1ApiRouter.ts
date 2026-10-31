import { createPublicV1Router } from "./createPublicV1Router";
import { getOpenApiSpecController } from "./getOpenApiSpecController";
import { searchRequestsController } from "./searchRequestsController";

/** The public API's Lambda handler (16-resident-action-models.md §2). Routes not yet listed here answer 404. */
export const publicV1ApiRouter = createPublicV1Router({
  "POST /v1/requests/search": searchRequestsController,
  "GET /v1/openapi.yaml": getOpenApiSpecController,
});
