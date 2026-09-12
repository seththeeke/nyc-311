import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAuthSession } from "aws-amplify/auth";

vi.mock("aws-amplify", () => ({ Amplify: { configure: vi.fn() } }));
vi.mock("aws-amplify/auth", () => ({ fetchAuthSession: vi.fn() }));

const mockedFetchAuthSession = vi.mocked(fetchAuthSession);

beforeEach(() => {
  mockedFetchAuthSession.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("capacityService — mock mode", () => {
  it("getCapacityStatus returns the 10 baked mock Operators, all IDLE at the default rate", async () => {
    vi.stubEnv("VITE_DATA_MODE", "mock");
    const { capacityService } = await import("../../src/services/capacityService");
    const { MOCK_OPERATORS } = await import("../../src/test-data/operators");

    const status = await capacityService.getCapacityStatus();

    expect(status).toEqual({
      available_count: MOCK_OPERATORS.length,
      fleet_size: MOCK_OPERATORS.length,
      hourly_burn_rate: MOCK_OPERATORS.length * 45,
      roster: MOCK_OPERATORS,
    });
  });

  it("addCapacity appends a new Operator at the default rate when omitted, reflected in the next status read", async () => {
    vi.stubEnv("VITE_DATA_MODE", "mock");
    const { capacityService } = await import("../../src/services/capacityService");
    const { MOCK_OPERATORS } = await import("../../src/test-data/operators");

    const added = await capacityService.addCapacity("Truck 12");

    expect(added.name).toBe("Truck 12");
    expect(added.rate_per_hour).toBe(45);
    expect(added.status).toBe("ACTIVE");
    expect(added.current_activity).toBe("IDLE");

    const status = await capacityService.getCapacityStatus();
    expect(status.fleet_size).toBe(MOCK_OPERATORS.length + 1);
  });

  it("addCapacity honors an explicit rate_per_hour", async () => {
    vi.stubEnv("VITE_DATA_MODE", "mock");
    const { capacityService } = await import("../../src/services/capacityService");

    const added = await capacityService.addCapacity("Truck 12", 99);

    expect(added.rate_per_hour).toBe(99);
  });

  it("removeCapacity finalizes an Operator immediately (mock mode never has a busy one)", async () => {
    vi.stubEnv("VITE_DATA_MODE", "mock");
    const { capacityService } = await import("../../src/services/capacityService");
    const { MOCK_OPERATORS } = await import("../../src/test-data/operators");

    const removed = await capacityService.removeCapacity(MOCK_OPERATORS[0].operator_id);

    expect(removed.status).toBe("INACTIVE");
    expect(removed.end_datetime).not.toBeNull();

    const status = await capacityService.getCapacityStatus();
    expect(status.fleet_size).toBe(MOCK_OPERATORS.length - 1);
    expect(status.roster.find((o) => o.operator_id === removed.operator_id)).toBeUndefined();
  });

  it("removeCapacity throws for an unknown operator_id", async () => {
    vi.stubEnv("VITE_DATA_MODE", "mock");
    const { capacityService } = await import("../../src/services/capacityService");

    await expect(capacityService.removeCapacity("01NOPE")).rejects.toThrow("No Operator found");
  });

  it("removeCapacity throws when the Operator is already removed", async () => {
    vi.stubEnv("VITE_DATA_MODE", "mock");
    const { capacityService } = await import("../../src/services/capacityService");
    const { MOCK_OPERATORS } = await import("../../src/test-data/operators");

    await capacityService.removeCapacity(MOCK_OPERATORS[0].operator_id);

    await expect(capacityService.removeCapacity(MOCK_OPERATORS[0].operator_id)).rejects.toThrow("already removed");
  });
});

describe("capacityService — live mode", () => {
  it("getCapacityStatus fetches with the bearer token and parses the response", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
    mockedFetchAuthSession.mockResolvedValue({
      tokens: { idToken: { toString: () => "id-token-value" } },
    } as never);
    const statusBody = { available_count: 1, fleet_size: 1, hourly_burn_rate: 45, roster: [] };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => statusBody });
    vi.stubGlobal("fetch", fetchMock);

    const { capacityService } = await import("../../src/services/capacityService");
    const status = await capacityService.getCapacityStatus();

    expect(fetchMock).toHaveBeenCalledWith("https://api.example.com/capacity", {
      headers: { Authorization: "Bearer id-token-value" },
    });
    expect(status).toEqual(statusBody);
  });

  it("getCapacityStatus throws when not authenticated (no idToken)", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    mockedFetchAuthSession.mockResolvedValue({ tokens: {} } as never);

    const { capacityService } = await import("../../src/services/capacityService");

    await expect(capacityService.getCapacityStatus()).rejects.toThrow("Not authenticated");
  });

  it("getCapacityStatus throws a descriptive error on a non-2xx response", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    mockedFetchAuthSession.mockResolvedValue({ tokens: { idToken: { toString: () => "id-token-value" } } } as never);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    const { capacityService } = await import("../../src/services/capacityService");

    await expect(capacityService.getCapacityStatus()).rejects.toThrow("Failed to fetch capacity status: HTTP 500");
  });

  it("addCapacity POSTs a JSON body with rate_per_hour when provided", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
    mockedFetchAuthSession.mockResolvedValue({ tokens: { idToken: { toString: () => "id-token-value" } } } as never);
    const operatorBody = {
      operator_id: "01OPERATOR",
      name: "Truck 12",
      status: "ACTIVE",
      current_activity: "IDLE",
      removal_requested_at: null,
      start_datetime: "2026-09-12T00:00:00.000Z",
      end_datetime: null,
      rate_per_hour: 60,
      last_event_sequence: 0,
    };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => operatorBody });
    vi.stubGlobal("fetch", fetchMock);

    const { capacityService } = await import("../../src/services/capacityService");
    const result = await capacityService.addCapacity("Truck 12", 60);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/capacity",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer id-token-value" }),
        body: JSON.stringify({ name: "Truck 12", rate_per_hour: 60 }),
      })
    );
    expect(result).toEqual(operatorBody);
  });

  it("addCapacity POSTs just the name when rate_per_hour is omitted", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    mockedFetchAuthSession.mockResolvedValue({ tokens: { idToken: { toString: () => "id-token-value" } } } as never);
    const operatorBody = {
      operator_id: "01OPERATOR",
      name: "Truck 12",
      status: "ACTIVE",
      current_activity: "IDLE",
      removal_requested_at: null,
      start_datetime: "2026-09-12T00:00:00.000Z",
      end_datetime: null,
      rate_per_hour: 45,
      last_event_sequence: 0,
    };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => operatorBody });
    vi.stubGlobal("fetch", fetchMock);

    const { capacityService } = await import("../../src/services/capacityService");
    await capacityService.addCapacity("Truck 12");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ body: JSON.stringify({ name: "Truck 12" }) })
    );
  });

  it("addCapacity throws a descriptive error on a non-2xx response", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    mockedFetchAuthSession.mockResolvedValue({ tokens: { idToken: { toString: () => "id-token-value" } } } as never);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 400 }));

    const { capacityService } = await import("../../src/services/capacityService");

    await expect(capacityService.addCapacity("Truck 12")).rejects.toThrow("Failed to add capacity: HTTP 400");
  });

  it("removeCapacity DELETEs the encoded operator_id path and parses the response", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
    mockedFetchAuthSession.mockResolvedValue({ tokens: { idToken: { toString: () => "id-token-value" } } } as never);
    const operatorBody = {
      operator_id: "01 OPERATOR",
      name: "Truck 12",
      status: "INACTIVE",
      current_activity: "IDLE",
      removal_requested_at: null,
      start_datetime: "2026-09-12T00:00:00.000Z",
      end_datetime: "2026-09-12T01:00:00.000Z",
      rate_per_hour: 45,
      last_event_sequence: 1,
    };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => operatorBody });
    vi.stubGlobal("fetch", fetchMock);

    const { capacityService } = await import("../../src/services/capacityService");
    const result = await capacityService.removeCapacity("01 OPERATOR");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/capacity/01%20OPERATOR",
      expect.objectContaining({ method: "DELETE" })
    );
    expect(result).toEqual(operatorBody);
  });

  it("removeCapacity throws a descriptive error on a non-2xx response", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    mockedFetchAuthSession.mockResolvedValue({ tokens: { idToken: { toString: () => "id-token-value" } } } as never);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));

    const { capacityService } = await import("../../src/services/capacityService");

    await expect(capacityService.removeCapacity("01OPERATOR")).rejects.toThrow(
      "Failed to remove capacity: HTTP 404"
    );
  });
});
