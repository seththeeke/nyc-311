import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IdTokenProvider } from "../../../service/agentAuth/idTokenProvider";

const jwt = (exp: number): string => `h.${Buffer.from(JSON.stringify({ exp })).toString("base64url")}.s`;
const CONFIG = { refreshToken: "r", clientId: "c", region: "us-east-1" };

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("IdTokenProvider", () => {
  it("hands back a token far from expiry with the real clock and fetch", async () => {
    const token = jwt(4_102_444_800);
    expect(await new IdTokenProvider({ ...CONFIG, idToken: token }).token()).toBe(token);
  });

  it("refreshes an expired token once, then reuses the new one", async () => {
    const fresh = jwt(4_102_444_800);
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ AuthenticationResult: { IdToken: fresh } }), { status: 200 }));
    const provider = new IdTokenProvider({ ...CONFIG, idToken: jwt(1) }, { fetch: fetchMock as unknown as typeof fetch });
    expect(await provider.token()).toBe(fresh);
    expect(await provider.token()).toBe(fresh);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("throws when Cognito returns no token", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({}), { status: 200 }));
    await expect(new IdTokenProvider({ ...CONFIG, idToken: "bad" }, { fetch: fetchMock as unknown as typeof fetch }).token()).rejects.toThrow("Cognito token refresh failed: HTTP 200");
  });
});
