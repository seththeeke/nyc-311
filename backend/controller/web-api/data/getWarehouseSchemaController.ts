import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { logError, logInfo } from "../../../logger";
import { getWarehouseSchema } from "../../../service/analytics/warehouseSchemaService";
import { ApiGatewayHttpEventSchema } from "../../../models/apiGatewayHttpEvent";
import { jsonResponse } from "../shared/jsonResponse";
import { errorResponse } from "../shared/errorResponse";

/**
 * `GET /data/schema` (`7-data-warehousing.md` §12) — live Glue Data
 * Catalog read, read-only. API Gateway is the caller, so failures map to
 * an HTTP status code rather than propagating.
 */
export const getWarehouseSchemaController = async (event: unknown): Promise<APIGatewayProxyStructuredResultV2> => {
  logInfo("GetWarehouseSchemaControllerInvoked", { event });

  const parsed = ApiGatewayHttpEventSchema.safeParse(event);
  if (!parsed.success) {
    logError("GetWarehouseSchemaControllerValidationFailed", { issues: parsed.error.issues });
    return jsonResponse(400, { message: "Malformed request" });
  }

  try {
    const schema = await getWarehouseSchema();
    logInfo("GetWarehouseSchemaControllerCompleted", { tableCount: schema.tables.length });
    return jsonResponse(200, schema);
  } catch (err) {
    logError("GetWarehouseSchemaControllerFailed", { error: err instanceof Error ? err.message : err });
    return errorResponse(err, "Failed to fetch warehouse schema");
  }
};
