import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { webhookSinkApiRouter } from "../../../../controller/web-api/webhookSink/webhookSinkApiRouter";
import { WEBHOOK_SINK_API_ROUTES } from "../../../../controller/web-api/webhookSink/webhookSinkApiRoutes";
import { getWebhookSinkDeliveriesController } from "../../../../controller/web-api/webhookSink/getWebhookSinkDeliveriesController";
import { receiveWebhookSinkController } from "../../../../controller/web-api/webhookSink/receiveWebhookSinkController";

vi.mock("../../../../controller/web-api/webhookSink/getWebhookSinkDeliveriesController", () => ({ getWebhookSinkDeliveriesController: vi.fn() }));
vi.mock("../../../../controller/web-api/webhookSink/receiveWebhookSinkController", () => ({ receiveWebhookSinkController: vi.fn() }));

const EXPECTED_CONTROLLERS: Record<(typeof WEBHOOK_SINK_API_ROUTES)[number], unknown> = {
  "POST /webhook-sink": receiveWebhookSinkController,
  "GET /webhook-sink/deliveries": getWebhookSinkDeliveriesController,
};

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("webhookSinkApiRouter", () => {
  it("covers exactly its 2 route(s)", () => {
    expect([...WEBHOOK_SINK_API_ROUTES].sort()).toEqual(Object.keys(EXPECTED_CONTROLLERS).sort());
  });

  it.each(WEBHOOK_SINK_API_ROUTES)("dispatches %s to its controller with the raw event", async (routeKey) => {
    const controller = vi.mocked(EXPECTED_CONTROLLERS[routeKey] as (event: unknown) => Promise<unknown>);
    controller.mockResolvedValue({ statusCode: 200, body: "{}" });
    const event = { routeKey, requestContext: {} };

    const response = await webhookSinkApiRouter(event);

    expect(response).toEqual({ statusCode: 200, body: "{}" });
    expect(controller).toHaveBeenCalledExactlyOnceWith(event);
    for (const [otherKey, other] of Object.entries(EXPECTED_CONTROLLERS)) {
      if (otherKey !== routeKey) expect(other).not.toHaveBeenCalled();
    }
  });

  it("returns 404 for an admin route key", async () => {
    const response = await webhookSinkApiRouter({ routeKey: "GET /admin/whoami", requestContext: {} });

    expect(response.statusCode).toBe(404);
  });
});
