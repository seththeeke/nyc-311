import { createFeatureRequestController } from "./createFeatureRequestController";
import { createPublicV1Router, type PublicV1Controller } from "./createPublicV1Router";
import { getFeatureRequestController } from "./getFeatureRequestController";
import { getOpenApiSpecController } from "./getOpenApiSpecController";
import type { PublicV1ApiRouteKey } from "./publicV1ApiRoutes";
import { searchRequestsController } from "./searchRequestsController";

/* Every route key must have a controller; a missing one fails to compile. */
const CONTROLLERS: Record<PublicV1ApiRouteKey, PublicV1Controller> = {
  "POST /v1/requests/search": searchRequestsController,
  "POST /v1/feature-requests": createFeatureRequestController,
  "GET /v1/feature-requests/{feature_request_id}": getFeatureRequestController,
  "GET /v1/openapi.yaml": getOpenApiSpecController,
};

/** The public API's Lambda handler (16-resident-action-models.md §2). */
export const publicV1ApiRouter = createPublicV1Router(CONTROLLERS);
