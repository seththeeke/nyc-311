import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { receiveWebhookController } from "../../../controller/webhook/receiveWebhookController";
import { UnauthorizedError, ValidationError } from "../../../models/errors";
import { receiveBureauWebhook } from "../../../service/webhook/webhookReceiverService";

vi.mock("../../../service/webhook/webhookReceiverService", () => ({ receiveBureauWebhook: vi.fn() }));
const mockedReceive = vi.mocked(receiveBureauWebhook);

const headers = { "webhook-id": "evt_01ORDER_1", "webhook-timestamp": "1791641000", "webhook-signature": "v1,abc" };

function event(overrides: Record<string, unknown> = {}): unknown {
  return { rawPath: "/webhooks/bureau", requestContext: { http: { method: "POST" } }, headers, body: "{}", ...overrides };
}

beforeEach(() => {
  mockedReceive.mockReset().mockResolvedValue("OPENED");
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("receiveWebhookController", () => {
  it("returns 200 with the outcome, passing headers and the raw body through", async () => {
    const response = await receiveWebhookController(event());
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body as string)).toEqual({ received: true, outcome: "OPENED" });
    expect(mockedReceive).toHaveBeenCalledWith(headers, "{}");
  });

  it("returns 200 for a repeat too, so the bureau stops retrying", async () => {
    mockedReceive.mockResolvedValue("ALREADY_KNOWN");
    expect((await receiveWebhookController(event())).statusCode).toBe(200);
  });

  it("defaults missing headers and body to empty", async () => {
    await receiveWebhookController(event({ headers: undefined, body: null }));
    expect(mockedReceive).toHaveBeenCalledWith({}, "");
  });

  it("returns 401 for a bad signature, 400 for an unreadable body or event, and 500 otherwise", async () => {
    expect((await receiveWebhookController({})).statusCode).toBe(400);
    const cases: [unknown, number][] = [
      [new UnauthorizedError("Invalid webhook signature"), 401],
      [new ValidationError("Webhook body is not JSON"), 400],
      [new Error("ddb down"), 500],
      ["not an error", 500],
    ];
    for (const [error, status] of cases) {
      mockedReceive.mockRejectedValueOnce(error);
      expect((await receiveWebhookController(event())).statusCode).toBe(status);
    }
  });
});
