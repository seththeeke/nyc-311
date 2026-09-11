import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Amplify } from "aws-amplify";
import { fetchAuthSession, signIn, signOut } from "aws-amplify/auth";

vi.mock("aws-amplify", () => ({ Amplify: { configure: vi.fn() } }));
vi.mock("aws-amplify/auth", () => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
  fetchAuthSession: vi.fn(),
}));

const mockedConfigure = vi.mocked(Amplify.configure);
const mockedSignIn = vi.mocked(signIn);
const mockedSignOut = vi.mocked(signOut);
const mockedFetchAuthSession = vi.mocked(fetchAuthSession);

beforeEach(() => {
  mockedConfigure.mockReset();
  mockedSignIn.mockReset();
  mockedSignOut.mockReset();
  mockedFetchAuthSession.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("authService — mock mode", () => {
  it("signs in with the fixed mock credential and returns the mock admin User", async () => {
    vi.stubEnv("VITE_DATA_MODE", "mock");
    const { authService } = await import("../../src/services/authService");
    const { MOCK_ADMIN_CREDENTIAL, MOCK_ADMIN_USER } = await import("../../src/test-data/adminUser");

    const user = await authService.signIn(MOCK_ADMIN_CREDENTIAL.email, MOCK_ADMIN_CREDENTIAL.password);

    expect(user).toEqual(MOCK_ADMIN_USER);
    await expect(authService.getCurrentUser()).resolves.toEqual(MOCK_ADMIN_USER);
  });

  it("rejects an incorrect mock credential", async () => {
    vi.stubEnv("VITE_DATA_MODE", "mock");
    const { authService } = await import("../../src/services/authService");

    await expect(authService.signIn("wrong@example.com", "wrong")).rejects.toThrow("Invalid email or password");
    await expect(authService.getCurrentUser()).resolves.toBeNull();
  });

  it("getCurrentUser returns null before any sign-in", async () => {
    vi.stubEnv("VITE_DATA_MODE", "mock");
    const { authService } = await import("../../src/services/authService");

    await expect(authService.getCurrentUser()).resolves.toBeNull();
  });

  it("signOut logs the mock session out", async () => {
    vi.stubEnv("VITE_DATA_MODE", "mock");
    const { authService } = await import("../../src/services/authService");
    const { MOCK_ADMIN_CREDENTIAL } = await import("../../src/test-data/adminUser");

    await authService.signIn(MOCK_ADMIN_CREDENTIAL.email, MOCK_ADMIN_CREDENTIAL.password);
    await authService.signOut();

    await expect(authService.getCurrentUser()).resolves.toBeNull();
  });
});

describe("authService — live mode", () => {
  it("signIn calls Amplify signIn, then resolves the current User via /admin/whoami", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
    mockedSignIn.mockResolvedValue({ isSignedIn: true, nextStep: { signInStep: "DONE" } });
    mockedFetchAuthSession.mockResolvedValue({
      tokens: { idToken: { toString: () => "id-token-value" } },
    } as never);
    const userBody = {
      user_id: "01ADMIN",
      type: "ADMIN",
      status: "ACTIVE",
      created_at: "2026-09-10T00:00:00.000Z",
      updated_at: "2026-09-10T00:00:00.000Z",
      last_active_at: "2026-09-10T00:00:00.000Z",
      cognito_sub: "abc-123",
      email: "admin@example.com",
      display_name: null,
    };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => userBody });
    vi.stubGlobal("fetch", fetchMock);

    const { authService } = await import("../../src/services/authService");
    const user = await authService.signIn("admin@example.com", "password123");

    expect(mockedSignIn).toHaveBeenCalledWith({ username: "admin@example.com", password: "password123" });
    expect(fetchMock).toHaveBeenCalledWith("https://api.example.com/admin/whoami", {
      headers: { Authorization: "Bearer id-token-value" },
    });
    expect(user).toEqual(userBody);
    expect(mockedConfigure).toHaveBeenCalled();
  });

  it("getCurrentUser returns null when there is no active session", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    mockedFetchAuthSession.mockRejectedValue(new Error("no session"));

    const { authService } = await import("../../src/services/authService");

    await expect(authService.getCurrentUser()).resolves.toBeNull();
  });

  it("getCurrentUser returns null when the session has no idToken", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    mockedFetchAuthSession.mockResolvedValue({ tokens: {} } as never);

    const { authService } = await import("../../src/services/authService");

    await expect(authService.getCurrentUser()).resolves.toBeNull();
  });

  it("getCurrentUser returns null when /admin/whoami responds with a non-2xx", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    mockedFetchAuthSession.mockResolvedValue({
      tokens: { idToken: { toString: () => "id-token-value" } },
    } as never);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));

    const { authService } = await import("../../src/services/authService");

    await expect(authService.getCurrentUser()).resolves.toBeNull();
  });

  it("signIn throws if getCurrentUser can't resolve a User after a successful Amplify sign-in", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    mockedSignIn.mockResolvedValue({ isSignedIn: true, nextStep: { signInStep: "DONE" } });
    mockedFetchAuthSession.mockResolvedValue({ tokens: {} } as never);

    const { authService } = await import("../../src/services/authService");

    await expect(authService.signIn("admin@example.com", "password123")).rejects.toThrow(
      "Signed in but failed to resolve the current user"
    );
  });

  it("signOut calls Amplify signOut", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    mockedSignOut.mockResolvedValue(undefined);

    const { authService } = await import("../../src/services/authService");
    await authService.signOut();

    expect(mockedSignOut).toHaveBeenCalled();
  });
});
