import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApiRouter } from "../../../../controller/web-api/shared/createApiRouter";

const listThings = vi.fn();
const getThing = vi.fn();
const router = createApiRouter<"GET /things" | "GET /things/{id}">("ThingsApi", {
  "GET /things": listThings,
  "GET /things/{id}": getThing,
});

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("createApiRouter", () => {
  it("dispatches the raw event to the route key's controller only, and returns its response", async () => {
    getThing.mockResolvedValue({ statusCode: 200, body: "{}" });
    const event = { routeKey: "GET /things/{id}", requestContext: {}, pathParameters: { id: "1" } };

    const response = await router(event);

    expect(response).toEqual({ statusCode: 200, body: "{}" });
    expect(getThing).toHaveBeenCalledExactlyOnceWith(event);
    expect(listThings).not.toHaveBeenCalled();
  });

  it("logs dispatch and completion under the bundle's name", async () => {
    listThings.mockResolvedValue({ statusCode: 204 });

    await router({ routeKey: "GET /things", requestContext: {} });

    const messages = vi.mocked(console.log).mock.calls.map(([line]) => JSON.parse(String(line)));
    expect(messages).toEqual([
      expect.objectContaining({ message: "ThingsApiRouterDispatch", routeKey: "GET /things" }),
      expect.objectContaining({ message: "ThingsApiRouterCompleted", routeKey: "GET /things", statusCode: 204 }),
    ]);
  });

  it("returns 400 for an event with no routeKey", async () => {
    const response = await router({ requestContext: {} });

    expect(response.statusCode).toBe(400);
    expect(listThings).not.toHaveBeenCalled();
  });

  it.each(["GET /other", "toString", "constructor"])("returns 404 for %s, a key it doesn't serve", async (routeKey) => {
    const response = await router({ routeKey, requestContext: {} });

    expect(response.statusCode).toBe(404);
    expect(listThings).not.toHaveBeenCalled();
    expect(getThing).not.toHaveBeenCalled();
  });
});
