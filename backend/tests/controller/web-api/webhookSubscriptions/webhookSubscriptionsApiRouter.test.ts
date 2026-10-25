import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { webhookSubscriptionsApiRouter } from "../../../../controller/web-api/webhookSubscriptions/webhookSubscriptionsApiRouter";
import { WEBHOOK_SUBSCRIPTIONS_API_ROUTES } from "../../../../controller/web-api/webhookSubscriptions/webhookSubscriptionsApiRoutes";
import { registerWebhookSubscriptionController } from "../../../../controller/web-api/webhookSubscriptions/registerWebhookSubscriptionController";

vi.mock("../../../../controller/web-api/webhookSubscriptions/registerWebhookSubscriptionController", () => ({ registerWebhookSubscriptionController: vi.fn() }));

const EXPECTED_CONTROLLERS: Record<(typeof WEBHOOK_SUBSCRIPTIONS_API_ROUTES)[number], unknown> = {
  "POST /webhook-subscriptions": registerWebhookSubscriptionController,
};

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("webhookSubscriptionsApiRouter", () => {
  it("covers exactly its 1 route(s)", () => {
    expect([...WEBHOOK_SUBSCRIPTIONS_API_ROUTES].sort()).toEqual(Object.keys(EXPECTED_CONTROLLERS).sort());
  });

  it.each(WEBHOOK_SUBSCRIPTIONS_API_ROUTES)("dispatches %s to its controller with the raw event", async (routeKey) => {
    const controller = vi.mocked(EXPECTED_CONTROLLERS[routeKey] as (event: unknown) => Promise<unknown>);
    controller.mockResolvedValue({ statusCode: 200, body: "{}" });
    const event = { routeKey, requestContext: {} };

    const response = await webhookSubscriptionsApiRouter(event);

    expect(response).toEqual({ statusCode: 200, body: "{}" });
    expect(controller).toHaveBeenCalledExactlyOnceWith(event);
    for (const [otherKey, other] of Object.entries(EXPECTED_CONTROLLERS)) {
      if (otherKey !== routeKey) expect(other).not.toHaveBeenCalled();
    }
  });

  it("returns 404 for an admin route key", async () => {
    const response = await webhookSubscriptionsApiRouter({ routeKey: "GET /admin/whoami", requestContext: {} });

    expect(response.statusCode).toBe(404);
  });
});
