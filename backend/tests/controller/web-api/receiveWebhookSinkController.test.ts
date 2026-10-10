import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { receiveWebhookSinkController } from "../../../controller/web-api/receiveWebhookSinkController";
import { ValidationError } from "../../../models/errors";
import { receiveSinkDelivery } from "../../../service/webhook/webhookSinkService";

vi.mock("../../../service/webhook/webhookSinkService", () => ({ receiveSinkDelivery: vi.fn() }));
const mockedReceive = vi.mocked(receiveSinkDelivery);

const headers = { "webhook-id": "evt_01ORDER_1", "webhook-timestamp": "1791641000", "webhook-signature": "v1,abc" };

function event(overrides: Record<string, unknown> = {}): unknown {
  return { rawPath: "/webhook-sink", requestContext: { http: { method: "POST" } }, headers, body: "{}", ...overrides };
}

beforeEach(() => {
  mockedReceive.mockReset().mockResolvedValue(true);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("receiveWebhookSinkController", () => {
  it("returns 200 for a valid signature and passes headers and the raw body through", async () => {
    const response = await receiveWebhookSinkController(event());
    expect(response.statusCode).toBe(200);
    expect(mockedReceive).toHaveBeenCalledWith(headers, "{}");
  });

  it("returns 401 for an invalid signature", async () => {
    mockedReceive.mockResolvedValue(false);
    expect((await receiveWebhookSinkController(event())).statusCode).toBe(401);
  });

  it("defaults missing headers and body to empty", async () => {
    await receiveWebhookSinkController(event({ headers: undefined, body: null }));
    expect(mockedReceive).toHaveBeenCalledWith({}, "");
  });

  it("returns 400 for a malformed event or a missing webhook-id, and 500 otherwise", async () => {
    expect((await receiveWebhookSinkController({})).statusCode).toBe(400);
    mockedReceive.mockRejectedValueOnce(new ValidationError("Missing webhook-id header"));
    expect((await receiveWebhookSinkController(event())).statusCode).toBe(400);
    mockedReceive.mockRejectedValueOnce(new Error("ddb down")).mockRejectedValueOnce("not an error");
    expect((await receiveWebhookSinkController(event())).statusCode).toBe(500);
    expect((await receiveWebhookSinkController(event())).statusCode).toBe(500);
  });
});
