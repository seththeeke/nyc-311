import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { evaluateRequest, type FilterFn } from "../../../service/ingestion/requestEvaluationService";
import type { RequestDao } from "../../../dao/request/requestDao";
import type { LocationDao } from "../../../dao/location/locationDao";
import type { OrderDao } from "../../../dao/order/orderDao";
import type { Request } from "../../../models/request";
import type { Location } from "../../../models/location";
import type { Order } from "../../../models/order";

const NOW = new Date("2026-08-20T00:00:00.000Z");

const draftRequest: Request = {
  request_id: "01REQUEST",
  source: "NYC_311",
  external_unique_key: "69243509",
  location_id: null,
  complaint_type: "Noise - Residential",
  descriptor: "Banging/Pounding",
  agency: "NYPD",
  raw_payload: { unique_key: "69243509" },
  status: "DRAFT",
  created_by: null,
  created_at: "2026-06-05T01:50:27.000",
};

function makeRequestDao(overrides: Partial<RequestDao> = {}): RequestDao {
  return {
    getRequestById: vi.fn().mockResolvedValue(draftRequest),
    updateRequestStatus: vi.fn().mockResolvedValue(draftRequest),
    ...overrides,
  } as unknown as RequestDao;
}

function makeLocationDao(overrides: Partial<LocationDao> = {}): LocationDao {
  const location: Location = {
    location_id: "1234567890",
    bbl: "1234567890",
    address: null,
    borough: null,
    community_board: null,
    zip: null,
    latitude: null,
    longitude: null,
    created_at: NOW.toISOString(),
  };
  return {
    findOrCreateLocation: vi.fn().mockResolvedValue(location),
    ...overrides,
  } as unknown as LocationDao;
}

function makeOrderDao(overrides: Partial<OrderDao> = {}): OrderDao {
  const order = { order_id: "01ORDER" } as Order;
  return {
    createOrder: vi.fn().mockResolvedValue(order),
    ...overrides,
  } as unknown as OrderDao;
}

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("evaluateRequest", () => {
  it("no-ops when the Request no longer exists", async () => {
    const requestDao = makeRequestDao({ getRequestById: vi.fn().mockResolvedValue(null) });
    const orderDao = makeOrderDao();

    await evaluateRequest(draftRequest, { requestDao, orderDao, now: () => NOW });

    expect(orderDao.createOrder).not.toHaveBeenCalled();
  });

  it("no-ops when the Request is no longer DRAFT (already evaluated)", async () => {
    const requestDao = makeRequestDao({
      getRequestById: vi.fn().mockResolvedValue({ ...draftRequest, status: "PROMOTED" }),
    });
    const orderDao = makeOrderDao();

    await evaluateRequest(draftRequest, { requestDao, orderDao, now: () => NOW });

    expect(orderDao.createOrder).not.toHaveBeenCalled();
    expect(requestDao.updateRequestStatus).not.toHaveBeenCalled();
  });

  it("halts (Request stays draft) and logs a stub Case when resolveLocation finds no bbl", async () => {
    const requestDao = makeRequestDao();
    const locationDao = makeLocationDao();
    const orderDao = makeOrderDao();
    const createCaseFn = vi.fn().mockResolvedValue(undefined);

    await evaluateRequest(draftRequest, { requestDao, locationDao, orderDao, createCaseFn, now: () => NOW });

    expect(createCaseFn).toHaveBeenCalledWith(
      expect.objectContaining({ case_type: "LOCATION_RESOLUTION_FAILURE", request_id: "01REQUEST" })
    );
    expect(locationDao.findOrCreateLocation).not.toHaveBeenCalled();
    expect(requestDao.updateRequestStatus).not.toHaveBeenCalled();
    expect(orderDao.createOrder).not.toHaveBeenCalled();
  });

  it("resolves the location, creates the Order, and promotes the Request when a bbl is present", async () => {
    const requestWithBbl: Request = {
      ...draftRequest,
      raw_payload: { unique_key: "69243509", bbl: "1234567890", borough: "QUEENS" },
    };
    const requestDao = makeRequestDao({ getRequestById: vi.fn().mockResolvedValue(requestWithBbl) });
    const locationDao = makeLocationDao();
    const orderDao = makeOrderDao();

    await evaluateRequest(requestWithBbl, { requestDao, locationDao, orderDao, now: () => NOW });

    expect(locationDao.findOrCreateLocation).toHaveBeenCalledWith(
      expect.objectContaining({ location_id: "1234567890", bbl: "1234567890", borough: "QUEENS" })
    );
    expect(orderDao.createOrder).toHaveBeenCalledWith({ request_id: "01REQUEST", location_id: "1234567890" });
    expect(requestDao.updateRequestStatus).toHaveBeenCalledWith("01REQUEST", "PROMOTED", "1234567890");
  });

  it("falls back to the real clock when now isn't provided in deps", async () => {
    const requestWithBbl: Request = {
      ...draftRequest,
      raw_payload: { unique_key: "69243509", bbl: "1234567890" },
    };
    const requestDao = makeRequestDao({ getRequestById: vi.fn().mockResolvedValue(requestWithBbl) });
    const locationDao = makeLocationDao();
    const orderDao = makeOrderDao();

    await evaluateRequest(requestWithBbl, { requestDao, locationDao, orderDao });

    expect(locationDao.findOrCreateLocation).toHaveBeenCalledWith(
      expect.objectContaining({ location_id: "1234567890" })
    );
  });

  it("rejects the Request (via a filter returning REJECT) without creating an Order", async () => {
    const requestDao = makeRequestDao();
    const orderDao = makeOrderDao();
    const rejectingFilter: FilterFn = async () => ({ kind: "REJECT", status: "FILTERED" });

    await evaluateRequest(draftRequest, { requestDao, orderDao, now: () => NOW, filters: [rejectingFilter] });

    expect(requestDao.updateRequestStatus).toHaveBeenCalledWith("01REQUEST", "FILTERED");
    expect(orderDao.createOrder).not.toHaveBeenCalled();
  });

  it("stops at the first filter that halts or rejects, never running later filters", async () => {
    const requestDao = makeRequestDao();
    const secondFilter: FilterFn = vi.fn().mockResolvedValue({ kind: "CONTINUE" });
    const haltingFilter: FilterFn = async () => ({ kind: "HALT" });

    await evaluateRequest(draftRequest, { requestDao, now: () => NOW, filters: [haltingFilter, secondFilter] });

    expect(secondFilter).not.toHaveBeenCalled();
  });

  it("throws if every filter continues but no filter ever resolved a location_id", async () => {
    const requestDao = makeRequestDao();
    const noopFilter: FilterFn = async () => ({ kind: "CONTINUE" });

    await expect(
      evaluateRequest(draftRequest, { requestDao, now: () => NOW, filters: [noopFilter] })
    ).rejects.toThrow(/without a resolved location_id/);
  });

  it("falls back to freshly constructed DAOs when none are provided in deps", async () => {
    const ddbMock = mockClient(DynamoDBDocumentClient);
    ddbMock.on(GetCommand).resolves({}); /* getRequestById finds no Item -> current is null -> early return */

    await evaluateRequest(draftRequest, { now: () => NOW });

    expect(ddbMock.commandCalls(GetCommand)).toHaveLength(1);
    ddbMock.restore();
  });
});

describe("module wiring", () => {
  it("does not throw on import when LOCATIONS_TABLE_NAME is unset (lazy construction, CLAUDE.md §5.2)", async () => {
    const previous = process.env.LOCATIONS_TABLE_NAME;
    delete process.env.LOCATIONS_TABLE_NAME;
    vi.resetModules();

    await expect(import("../../../service/ingestion/requestEvaluationService.js")).resolves.toBeDefined();

    process.env.LOCATIONS_TABLE_NAME = previous;
    vi.resetModules();
  });

  it("throws only when evaluateRequest is actually called without deps.locationDao and the env var is unset", async () => {
    const previous = process.env.LOCATIONS_TABLE_NAME;
    delete process.env.LOCATIONS_TABLE_NAME;
    vi.resetModules();
    const { evaluateRequest: freshEvaluateRequest } = await import(
      "../../../service/ingestion/requestEvaluationService.js"
    );
    const requestDao = makeRequestDao();
    const requestWithBbl: Request = { ...draftRequest, raw_payload: { unique_key: "69243509", bbl: "1234567890" } };

    await expect(
      freshEvaluateRequest(requestWithBbl, { requestDao, now: () => NOW })
    ).rejects.toThrow("Missing required environment variable: LOCATIONS_TABLE_NAME");

    process.env.LOCATIONS_TABLE_NAME = previous;
    vi.resetModules();
  });
});
