import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { teamChatApiRouter } from "../../../../controller/web-api/teamChat/teamChatApiRouter";
import { TEAM_CHAT_API_ROUTES, TEAM_CHAT_MEMBER_ROUTES, TEAM_CHAT_READ_ROUTES } from "../../../../controller/web-api/teamChat/teamChatApiRoutes";
import { listChannelsController } from "../../../../controller/web-api/teamChat/listChannelsController";
import { postMessageController } from "../../../../controller/web-api/teamChat/postMessageController";

vi.mock("../../../../controller/web-api/teamChat/listChannelsController", () => ({ listChannelsController: vi.fn().mockResolvedValue({ statusCode: 200 }) }));
vi.mock("../../../../controller/web-api/teamChat/postMessageController", () => ({ postMessageController: vi.fn().mockResolvedValue({ statusCode: 201 }) }));

function eventFor(routeKey: string, claims?: Record<string, string>): unknown {
  return { routeKey, requestContext: claims ? { authorizer: { jwt: { claims } } } : {} };
}

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("teamChat route lists", () => {
  it("are unversioned, disjoint, and together the full API", () => {
    expect(TEAM_CHAT_API_ROUTES.every((route) => !/ \/v\d+\//.test(route))).toBe(true);
    expect(TEAM_CHAT_READ_ROUTES.every((route) => route.startsWith("GET "))).toBe(true);
    expect(new Set(TEAM_CHAT_API_ROUTES).size).toBe(TEAM_CHAT_READ_ROUTES.length + TEAM_CHAT_MEMBER_ROUTES.length);
  });
});

describe("teamChatApiRouter", () => {
  it("dispatches a read route with no claims", async () => {
    expect((await teamChatApiRouter(eventFor("GET /channels"))).statusCode).toBe(200);
    expect(listChannelsController).toHaveBeenCalledOnce();
  });

  it("dispatches a member route for a BOROUGH_SIM_TEAM caller", async () => {
    const response = await teamChatApiRouter(eventFor("POST /channels/{channel_id}/messages", { email: "a@b.com", "cognito:groups": "[BOROUGH_SIM_TEAM]" }));
    expect(response.statusCode).toBe(201);
  });

  it("refuses a member route outside BOROUGH_SIM_TEAM with 403, and with no claims with 500", async () => {
    expect((await teamChatApiRouter(eventFor("POST /channels/{channel_id}/messages", { email: "a@b.com", "cognito:groups": "[ADMIN]" }))).statusCode).toBe(403);
    expect((await teamChatApiRouter(eventFor("POST /channels/{channel_id}/messages"))).statusCode).toBe(500);
    expect(postMessageController).not.toHaveBeenCalled();
  });

  it("400s a malformed event and 404s an unknown route", async () => {
    expect((await teamChatApiRouter({})).statusCode).toBe(400);
    expect((await teamChatApiRouter(eventFor("GET /nope"))).statusCode).toBe(404);
  });
});
