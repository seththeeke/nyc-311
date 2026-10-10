import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getWebhookSinkDeliveriesController } from "../../../controller/web-api/getWebhookSinkDeliveriesController";
import { listSinkDeliveries } from "../../../service/webhook/webhookSinkService";

vi.mock("../../../service/webhook/webhookSinkService", () => ({ listSinkDeliveries: vi.fn() }));
const mockedList = vi.mocked(listSinkDeliveries);

const event = { rawPath: "/webhook-sink/deliveries", requestContext: { http: { method: "GET" } } };
const delivery = { webhook_id: "evt_1", event_type: "ORDER_ACCEPTED", received_at: "2026-10-10T14:03:12.000Z", signature_valid: true, expires_at: 1791000000 };

beforeEach(() => {
  mockedList.mockReset().mockResolvedValue([delivery]);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getWebhookSinkDeliveriesController", () => {
  it("returns 200 with the deliveries", async () => {
    const response = await getWebhookSinkDeliveriesController(event);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body as string)).toEqual({ deliveries: [delivery] });
  });

  it("returns 400 for a malformed event and 500 when the service fails", async () => {
    expect((await getWebhookSinkDeliveriesController({})).statusCode).toBe(400);
    mockedList.mockRejectedValueOnce(new Error("ddb down")).mockRejectedValueOnce("not an error");
    expect((await getWebhookSinkDeliveriesController(event)).statusCode).toBe(500);
    expect((await getWebhookSinkDeliveriesController(event)).statusCode).toBe(500);
  });
});
