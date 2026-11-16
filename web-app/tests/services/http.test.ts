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

describe("authorizedFetch", () => {
  it("prefixes the API base URL and adds the bearer token on top of the caller's headers", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
    mockedFetchAuthSession.mockResolvedValue({ tokens: { idToken: { toString: () => "id-token-value" } } } as never);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const { authorizedFetch } = await import("../../src/services/http");
    await authorizedFetch("/admin/thing", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });

    expect(fetchMock).toHaveBeenCalledWith("https://api.example.com/admin/thing", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer id-token-value" },
      body: "{}",
    });
  });

  it("sends only the bearer token when no init is given", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
    mockedFetchAuthSession.mockResolvedValue({ tokens: { idToken: { toString: () => "id-token-value" } } } as never);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const { authorizedFetch } = await import("../../src/services/http");
    await authorizedFetch("/admin/thing");

    expect(fetchMock).toHaveBeenCalledWith("https://api.example.com/admin/thing", {
      headers: { Authorization: "Bearer id-token-value" },
    });
  });

  it("throws without calling fetch when there is no id token", async () => {
    mockedFetchAuthSession.mockResolvedValue({ tokens: undefined } as never);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { authorizedFetch } = await import("../../src/services/http");

    await expect(authorizedFetch("/admin/thing")).rejects.toThrow("Not authenticated");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("readApiErrorMessage", () => {
  it("returns the body's string message", async () => {
    const { readApiErrorMessage } = await import("../../src/services/http");
    const response = { json: () => Promise.resolve({ message: "reload and retry" }) } as Response;

    await expect(readApiErrorMessage(response)).resolves.toBe("reload and retry");
  });

  it("returns undefined for a body that is not the error shape", async () => {
    const { readApiErrorMessage } = await import("../../src/services/http");
    const response = { json: () => Promise.resolve({ message: 42 }) } as Response;

    await expect(readApiErrorMessage(response)).resolves.toBeUndefined();
  });

  it("returns undefined when the body is not JSON", async () => {
    const { readApiErrorMessage } = await import("../../src/services/http");
    const response = { json: () => Promise.reject(new SyntaxError("Unexpected token")) } as Response;

    await expect(readApiErrorMessage(response)).resolves.toBeUndefined();
  });
});
