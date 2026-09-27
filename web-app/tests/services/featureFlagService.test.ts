import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAuthSession } from "aws-amplify/auth";
import type { FeatureFlagInput } from "../../src/models/featureFlag";
import { MOCK_FEATURE_FLAGS } from "../../src/test-data/featureFlags";

vi.mock("aws-amplify", () => ({ Amplify: { configure: vi.fn() } }));
vi.mock("aws-amplify/auth", () => ({ fetchAuthSession: vi.fn() }));

const mockedFetchAuthSession = vi.mocked(fetchAuthSession);

const input: FeatureFlagInput = { description: "", treatments: ["ON", "OFF"], default_treatment: "OFF", overrides: [], allocations: [] };
const costModel = MOCK_FEATURE_FLAGS[0];

async function loadService(mode: "mock" | "live") {
  vi.stubEnv("VITE_DATA_MODE", mode);
  vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
  return (await import("../../src/services/featureFlagService")).featureFlagService;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), { status });
}

beforeEach(() => {
  mockedFetchAuthSession.mockReset();
  mockedFetchAuthSession.mockResolvedValue({ tokens: { idToken: { toString: () => "id-token" } } } as never);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("featureFlagService — mock mode", () => {
  it("lists the baked flags sorted by key", async () => {
    const service = await loadService("mock");
    expect((await service.listFeatureFlags()).map((flag) => flag.flag_key)).toEqual(["COST_MODEL", "FAILURE_INJECTION"]);
  });

  it("creates, updates with a version check, and deletes", async () => {
    const service = await loadService("mock");
    const created = await service.createFeatureFlag({ ...input, flag_key: "NEW_FLAG" });
    expect(created.version).toBe(1);
    await expect(service.createFeatureFlag({ ...input, flag_key: "NEW_FLAG" })).rejects.toThrow("already exists");

    const updated = await service.updateFeatureFlag("NEW_FLAG", { ...input, default_treatment: "ON", expected_version: 1 });
    expect(updated).toMatchObject({ version: 2, default_treatment: "ON", created_at: created.created_at });
    await expect(service.updateFeatureFlag("NEW_FLAG", { ...input, expected_version: 1 })).rejects.toThrow("reload and retry");
    await expect(service.updateFeatureFlag("MISSING", { ...input, expected_version: 1 })).rejects.toThrow("No feature flag MISSING");

    await service.deleteFeatureFlag("NEW_FLAG");
    await expect(service.deleteFeatureFlag("NEW_FLAG")).rejects.toThrow("No feature flag NEW_FLAG");
    expect((await service.listFeatureFlags()).some((flag) => flag.flag_key === "NEW_FLAG")).toBe(false);
  });
});

describe("featureFlagService — live mode", () => {
  it("lists flags publicly (no auth header)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { flags: [costModel] }));
    vi.stubGlobal("fetch", fetchMock);
    const service = await loadService("live");

    await expect(service.listFeatureFlags()).resolves.toEqual([costModel]);
    expect(fetchMock).toHaveBeenCalledWith("https://api.example.com/feature-flags");
    expect(mockedFetchAuthSession).not.toHaveBeenCalled();
  });

  it("creates, updates, and deletes through the admin routes with the ID token", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(201, costModel))
      .mockResolvedValueOnce(jsonResponse(200, { ...costModel, version: 4 }))
      .mockResolvedValueOnce(jsonResponse(204, undefined));
    vi.stubGlobal("fetch", fetchMock);
    const service = await loadService("live");

    await expect(service.createFeatureFlag({ ...input, flag_key: "COST_MODEL" })).resolves.toEqual(costModel);
    await expect(service.updateFeatureFlag("COST_MODEL", { ...input, expected_version: 3 })).resolves.toMatchObject({ version: 4 });
    await expect(service.deleteFeatureFlag("COST_MODEL")).resolves.toBeUndefined();

    const [createCall, updateCall, deleteCall] = fetchMock.mock.calls;
    expect(createCall[0]).toBe("https://api.example.com/admin/feature-flags");
    expect(createCall[1]).toMatchObject({ method: "POST", headers: { Authorization: "Bearer id-token" } });
    expect(JSON.parse(updateCall[1].body)).toEqual({ ...input, expected_version: 3 });
    expect(updateCall[0]).toBe("https://api.example.com/admin/feature-flags/COST_MODEL");
    expect(deleteCall[1]).toMatchObject({ method: "DELETE" });
  });

  it("surfaces the API's message on failure, falling back to the status", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(409, { message: "changed since version 3" }))
        .mockResolvedValueOnce(new Response("not json", { status: 500 }))
        .mockResolvedValueOnce(jsonResponse(404, { other: true }))
        .mockResolvedValueOnce(jsonResponse(500, { message: "boom" }))
    );
    const service = await loadService("live");

    await expect(service.updateFeatureFlag("COST_MODEL", { ...input, expected_version: 3 })).rejects.toThrow(
      "Failed to update feature flag: changed since version 3"
    );
    await expect(service.listFeatureFlags()).rejects.toThrow("Failed to list feature flags: HTTP 500");
    await expect(service.deleteFeatureFlag("COST_MODEL")).rejects.toThrow("Failed to delete feature flag: HTTP 404");
    await expect(service.createFeatureFlag({ ...input, flag_key: "X" })).rejects.toThrow("Failed to create feature flag: boom");
  });

  it("refuses admin writes without a session", async () => {
    mockedFetchAuthSession.mockResolvedValue({ tokens: undefined } as never);
    vi.stubGlobal("fetch", vi.fn());
    const service = await loadService("live");
    await expect(service.deleteFeatureFlag("COST_MODEL")).rejects.toThrow("Not authenticated");
  });
});
