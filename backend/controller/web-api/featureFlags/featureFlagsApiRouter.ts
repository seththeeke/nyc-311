import { createApiRouter } from "../shared/createApiRouter";
import type { FeatureFlagsApiRouteKey } from "./featureFlagsApiRoutes";
import { getFeatureFlagController } from "./getFeatureFlagController";
import { getTreatmentController } from "./getTreatmentController";
import { listFeatureFlagsController } from "./listFeatureFlagsController";

/** The featureFlags Service API bundle's Lambda handler (15-resource-consolidation.md §3.3). */
export const featureFlagsApiRouter = createApiRouter<FeatureFlagsApiRouteKey>("FeatureFlagsApi", {
  "GET /feature-flags": listFeatureFlagsController,
  "GET /feature-flags/{flag_key}": getFeatureFlagController,
  "POST /feature-flags/{flag_key}/treatment": getTreatmentController,
});
