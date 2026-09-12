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

describe("schedulingService — mock mode", () => {
  it("runScheduling resolves without hitting the network", async () => {
    vi.stubEnv("VITE_DATA_MODE", "mock");
    const { schedulingService } = await import("../../src/services/schedulingService");

    await expect(schedulingService.runScheduling()).resolves.toBeUndefined();
  });
});

describe("schedulingService — live mode", () => {
  it("POSTs /scheduling/run with the bearer token", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
    mockedFetchAuthSession.mockResolvedValue({
      tokens: { idToken: { toString: () => "id-token-value" } },
    } as never);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const { schedulingService } = await import("../../src/services/schedulingService");
    await schedulingService.runScheduling();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/scheduling/run",
      expect.objectContaining({ method: "POST", headers: expect.objectContaining({ Authorization: "Bearer id-token-value" }) })
    );
  });

  it("throws when not authenticated (no idToken)", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    mockedFetchAuthSession.mockResolvedValue({ tokens: {} } as never);

    const { schedulingService } = await import("../../src/services/schedulingService");

    await expect(schedulingService.runScheduling()).rejects.toThrow("Not authenticated");
  });

  it("throws a descriptive error on a non-2xx response", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    mockedFetchAuthSession.mockResolvedValue({ tokens: { idToken: { toString: () => "id-token-value" } } } as never);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    const { schedulingService } = await import("../../src/services/schedulingService");

    await expect(schedulingService.runScheduling()).rejects.toThrow("Failed to run scheduling: HTTP 500");
  });
});
