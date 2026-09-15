import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { logInfo, logWarn } from "../../logger";
import { RequestDao } from "../../dao/request/requestDao";
import { LocationDao } from "../../dao/location/locationDao";
import { OrderDao } from "../../dao/order/orderDao";
import { createCase } from "../case/caseService";
import type { Request } from "../../models/request";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/* Constructed lazily inside evaluateRequest, not at module scope — per CLAUDE.md §5.2 (revised 2026-08-22). */
function getDefaultRequestDao(): RequestDao {
  return new RequestDao(DynamoDBDocumentClient.from(new DynamoDBClient({})), requireEnv("REQUESTS_TABLE_NAME"));
}
function getDefaultLocationDao(): LocationDao {
  return new LocationDao(DynamoDBDocumentClient.from(new DynamoDBClient({})), requireEnv("LOCATIONS_TABLE_NAME"));
}
function getDefaultOrderDao(): OrderDao {
  return new OrderDao(DynamoDBDocumentClient.from(new DynamoDBClient({})), requireEnv("ORDERS_TABLE_NAME"));
}

/**
 * The outcome contract every filter function in {@link FILTERS} returns
 * (`3-order-ingestion.md` §3). `CONTINUE` may carry `locationId` — the
 * only value a filter needs to pass forward today; generalize to a patch
 * bag if a second filter ever needs to.
 */
export type FilterOutcome =
  | { readonly kind: "CONTINUE"; readonly locationId?: string }
  | { readonly kind: "REJECT"; readonly status: "FILTERED" }
  | { readonly kind: "HALT" };

interface FilterDeps {
  locationDao: LocationDao;
  createCase: typeof createCase;
  now: () => Date;
}

export type FilterFn = (request: Request, deps: FilterDeps) => Promise<FilterOutcome>;

function stringField(rawPayload: Record<string, unknown>, key: string): string | null {
  const value = rawPayload[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * The only real filter today (`3-order-ingestion.md` §1) — BBL-from-payload
 * only, no geocoding fallback. A miss halts the pipeline (Request stays
 * `DRAFT`) rather than rejecting, and logs a `location_resolution_failure`
 * Case via the stub service — real Case persistence doesn't exist yet.
 */
async function resolveLocation(request: Request, deps: FilterDeps): Promise<FilterOutcome> {
  const bbl = stringField(request.raw_payload, "bbl");
  if (!bbl) {
    await deps.createCase({
      case_type: "LOCATION_RESOLUTION_FAILURE",
      request_id: request.request_id,
      order_id: null,
      reason: "No bbl present in raw_payload",
    });
    return { kind: "HALT" };
  }

  const location = await deps.locationDao.findOrCreateLocation({
    location_id: bbl,
    bbl,
    address: stringField(request.raw_payload, "incident_address"),
    borough: stringField(request.raw_payload, "borough"),
    community_board: stringField(request.raw_payload, "community_board"),
    zip: stringField(request.raw_payload, "incident_zip"),
    latitude: stringField(request.raw_payload, "latitude"),
    longitude: stringField(request.raw_payload, "longitude"),
    created_at: deps.now().toISOString(),
  });

  return { kind: "CONTINUE", locationId: location.location_id };
}

/**
 * Rejects a Request whose raw NYC 311 record already carries a
 * `closed_date` — the complaint was already closed before it was ever
 * ingested, so it never gets promoted to an Order
 * (`11-street-condition-implementation.md` §1; supersedes the
 * `3-order-ingestion.md` §1 stub of the same name).
 */
async function checkAlreadyClosed(request: Request): Promise<FilterOutcome> {
  const closedDate = stringField(request.raw_payload, "closed_date");
  return closedDate ? { kind: "REJECT", status: "FILTERED" } : { kind: "CONTINUE" };
}

const FILTERS: readonly FilterFn[] = [resolveLocation, checkAlreadyClosed];

/**
 * Dependencies for {@link evaluateRequest} — all default to this module's
 * own singletons. `filters` defaults to the real {@link FILTERS} pipeline;
 * tests may still override it to exercise `evaluateRequest`'s own
 * REJECT/HALT handling in isolation from either real filter's logic.
 */
export interface RequestEvaluationDeps {
  requestDao?: RequestDao;
  locationDao?: LocationDao;
  orderDao?: OrderDao;
  createCaseFn?: typeof createCase;
  now?: () => Date;
  filters?: readonly FilterFn[];
}

/**
 * Runs one `Request` through the filter pipeline (`3-order-ingestion.md`
 * §1/§3), promoting it and creating its `Order` if every filter continues.
 * Re-fetches the Request's current status rather than trusting the SQS
 * message body, and no-ops if it's no longer `DRAFT` — the request-
 * processor's queue is standard (at-least-once), so a redelivered message
 * must never double-process an already-evaluated Request.
 */
export async function evaluateRequest(request: Request, deps: RequestEvaluationDeps = {}): Promise<void> {
  const requestDao = deps.requestDao ?? getDefaultRequestDao();
  const locationDao = deps.locationDao ?? getDefaultLocationDao();
  const orderDao = deps.orderDao ?? getDefaultOrderDao();
  const createCaseFn = deps.createCaseFn ?? createCase;
  const now = deps.now ?? (() => new Date());
  const filters = deps.filters ?? FILTERS;

  logInfo("RequestEvaluationStarted", { requestId: request.request_id });

  const current = await requestDao.getRequestById(request.request_id);
  if (!current) {
    logWarn("RequestEvaluationRequestNotFound", { requestId: request.request_id });
    return;
  }
  if (current.status !== "DRAFT") {
    logInfo("RequestEvaluationSkippedAlreadyProcessed", { requestId: request.request_id, status: current.status });
    return;
  }

  const filterDeps: FilterDeps = { locationDao, createCase: createCaseFn, now };
  let locationId: string | null = null;

  for (const filter of filters) {
    const outcome = await filter(current, filterDeps);
    logInfo("FilterEvaluated", { requestId: current.request_id, filter: filter.name, outcome });

    if (outcome.kind === "HALT") {
      logInfo("RequestEvaluationCompleted", { requestId: current.request_id, result: "HALTED" });
      return;
    }
    if (outcome.kind === "REJECT") {
      await requestDao.updateRequestStatus(current.request_id, outcome.status);
      logInfo("RequestEvaluationCompleted", { requestId: current.request_id, result: outcome.status });
      return;
    }
    if (outcome.locationId) {
      locationId = outcome.locationId;
    }
  }

  if (!locationId) {
    throw new Error(`Request ${current.request_id} passed all filters without a resolved location_id`);
  }

  const order = await orderDao.createOrder({
    request_id: current.request_id,
    location_id: locationId,
    complaint_type: current.complaint_type,
  });
  await requestDao.updateRequestStatus(current.request_id, "PROMOTED", locationId);
  logInfo("RequestEvaluationCompleted", {
    requestId: current.request_id,
    result: "PROMOTED",
    orderId: order.order_id,
  });
}
