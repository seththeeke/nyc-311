import { createApiRouter } from "../shared/createApiRouter";
import type { MonitoringApiRouteKey } from "./monitoringApiRoutes";
import { getLambdaMetricsController } from "./getLambdaMetricsController";
import { getPollerMetricsController } from "./getPollerMetricsController";
import { getPublicApiMetricsController } from "./getPublicApiMetricsController";

/** The monitoring Service API bundle's Lambda handler (15-resource-consolidation.md §3.3). */
export const monitoringApiRouter = createApiRouter<MonitoringApiRouteKey>("MonitoringApi", {
  "GET /ingestion/metrics": getPollerMetricsController,
  "GET /lambda-metrics": getLambdaMetricsController,
  "GET /public-api/metrics": getPublicApiMetricsController,
});
