import { createApiRouter } from "../shared/createApiRouter";
import type { DataApiRouteKey } from "./dataApiRoutes";
import { getWarehouseSchemaController } from "./getWarehouseSchemaController";
import { getWorkspaceMetricsController } from "./getWorkspaceMetricsController";

/** The data Service API bundle's Lambda handler (15-resource-consolidation.md §3.3). */
export const dataApiRouter = createApiRouter<DataApiRouteKey>("DataApi", {
  "GET /data/schema": getWarehouseSchemaController,
  "GET /workspace/metrics": getWorkspaceMetricsController,
});
