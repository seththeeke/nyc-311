import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { logInfo } from "../../logger";
import { ValidationError } from "../../models/errors";
import type { Location } from "../../models/location";
import type { Order, OrderRejectionReasonCode } from "../../models/order";
import type { SearchRequestsBody, SearchRequestsResponse } from "../../models/publicApi/searchRequests";
import type { ServiceRequest, ServiceRequestStatus } from "../../models/publicApi/serviceRequest";
import { getLocation } from "../location/locationService";
import { getOrder, getOrderRejectionReasonCode } from "../order/orderService";

/*
 * The public API's service layer (16-resident-action-models.md §2.3):
 * public model in, domain service calls, public model out. Calls domain
 * services only, never a DAO; every public controller goes through it.
 */

export interface GetOpenApiSpecDeps {
  /* Where the spec is; the Lambda bundle carries it beside the handler. */
  specPath?: string;
}

/** The hand-maintained OpenAPI document, as YAML text. */
export async function getOpenApiSpec(deps: GetOpenApiSpecDeps = {}): Promise<string> {
  const specPath = deps.specPath ?? join(__dirname, "openapi.yaml");
  const spec = await readFile(specPath, "utf8");
  logInfo("PublicApiSpecRead", { specPath, bytes: spec.length });
  return spec;
}

/* Public wording for each rejection code; never the internal reason text. */
const REJECTION_REASONS: Record<OrderRejectionReasonCode, string> = {
  SERVICE_NOT_SUPPORTED: "This type of request isn't serviced.",
  LOCATION_UNRESOLVED: "The location of this request couldn't be resolved.",
};

/** An Order's public status (16-resident-action-models.md §2.4.1). */
export function toServiceRequestStatus(order: Order): ServiceRequestStatus {
  if (order.status === "REJECTED") return "NOT_SERVICED";
  if (order.status === "CREATED") return "RECEIVED";
  switch (order.current_stage) {
    case "SCHEDULE":
      return order.scheduled_start ? "SCHEDULED" : "ACCEPTED";
    case "EXECUTE":
      return "IN_PROGRESS";
    case "RESOLVE":
      return "RESOLVED";
    default:
      return "RECEIVED";
  }
}

/** The public view of an Order and its Location; nothing internal leaves here. */
export function toServiceRequest(order: Order, location: Location | null, rejectionReasonCode: OrderRejectionReasonCode | null): ServiceRequest {
  const status = toServiceRequestStatus(order);
  return {
    order_id: order.order_id,
    request_id: order.request_id,
    complaint_type: order.complaint_type,
    borough: location?.borough ?? null,
    address: location?.address ?? null,
    zip: location?.zip ?? null,
    status,
    status_reason_description: status === "NOT_SERVICED" && rejectionReasonCode ? REJECTION_REASONS[rejectionReasonCode] : null,
    scheduled_window:
      order.scheduled_start && order.scheduled_end ? { start: order.scheduled_start, end: order.scheduled_end } : null,
    received_at: order.created_at,
    status_updated_at: order.updated_at,
  };
}

/**
 * `SEARCH_REQUESTS` (16-resident-action-models.md §2.4.1): the Order named by
 * `search_params.order_id`, with its Location, as a one-item page; an
 * unknown id is an empty page. v1 never returns a cursor, so any cursor
 * sent belongs to no search of this one.
 *
 * @throws {@link ValidationError} with public `details` if a cursor is sent.
 */
export async function searchRequests(body: SearchRequestsBody): Promise<SearchRequestsResponse> {
  if (body.cursor) {
    throw new ValidationError("The cursor doesn't belong to this search.", [{ field: "cursor", issue: "does not belong to this search" }]);
  }
  const orderId = body.search_params.order_id;
  const order = await getOrder(orderId);
  if (!order) {
    logInfo("PublicSearchRequestsNoMatch", { orderId });
    return { items: [], next_cursor: null };
  }
  const location = order.location_id ? await getLocation(order.location_id) : null;
  const rejectionReasonCode = order.status === "REJECTED" ? await getOrderRejectionReasonCode(orderId) : null;
  const item = toServiceRequest(order, location, rejectionReasonCode);
  logInfo("PublicSearchRequestsMatched", { orderId, status: item.status, hasLocation: location !== null });
  return { items: [item], next_cursor: null };
}
