import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerWebhookSubscriptionController } from "../../../controller/web-api/registerWebhookSubscriptionController";
import { ConflictError, TerminalError, UnauthorizedError, ValidationError } from "../../../models/errors";
import { WebhookSubscriptionResponseSchema } from "../../../models/webhookSubscription";
import { registerWebhookSubscription } from "../../../service/webhook/webhookSubscriptionService";
import { SECRET, subscription } from "../../service/webhook/webhookTestFixtures";

vi.mock("../../../service/webhook/webhookSubscriptionService", () => ({ registerWebhookSubscription: vi.fn() }));
const mockedRegister = vi.mocked(registerWebhookSubscription);

const KEY = "registration-key-value";
const requestBody = { name: "the-customer", callback_url: subscription.callback_url, event_types: ["ORDER_ACCEPTED"], secret: SECRET };
const responseBody = WebhookSubscriptionResponseSchema.parse(subscription);

function event(body: string | null, headers: Record<string, string> | null = { "x-api-key": KEY }): unknown {
  return {
    rawPath: "/webhook-subscriptions",
    requestContext: { http: { method: "POST" } },
    ...(headers ? { headers } : {}),
    body,
  };
}

let logSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  mockedRegister.mockReset().mockResolvedValue({ subscription: responseBody, created: true });
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("registerWebhookSubscriptionController", () => {
  it("returns 201 for a new subscription and passes the key header to the service", async () => {
    const response = await registerWebhookSubscriptionController(event(JSON.stringify(requestBody)));
    expect(response.statusCode).toBe(201);
    expect(JSON.parse(response.body as string)).toEqual(responseBody);
    expect(mockedRegister).toHaveBeenCalledWith(requestBody, KEY);
  });

  it("returns 200 when the callback URL was already registered", async () => {
    mockedRegister.mockResolvedValue({ subscription: responseBody, created: false });
    expect((await registerWebhookSubscriptionController(event(JSON.stringify(requestBody)))).statusCode).toBe(200);
  });

  it("never logs the registration key or the signing secret", async () => {
    await registerWebhookSubscriptionController(event(JSON.stringify(requestBody)));
    await registerWebhookSubscriptionController(event(JSON.stringify({ ...requestBody, secret: "whsec_short" })));
    const logged = JSON.stringify([...logSpy.mock.calls, ...errorSpy.mock.calls]);
    expect(logged).not.toContain(KEY);
    expect(logged).not.toContain(SECRET);
    expect(logged).not.toContain("whsec_short");
    expect(logged).toContain("[REDACTED]");
    expect(logged).toContain(subscription.callback_url);
  });

  it("passes undefined for a missing key header and still logs the request", async () => {
    await registerWebhookSubscriptionController(event(JSON.stringify(requestBody), {}));
    await registerWebhookSubscriptionController(event(JSON.stringify(requestBody), null));
    expect(mockedRegister).toHaveBeenNthCalledWith(1, requestBody, undefined);
    expect(mockedRegister).toHaveBeenNthCalledWith(2, requestBody, undefined);
  });

  it("returns 400 for a malformed event, bad JSON, a missing body, or an invalid body", async () => {
    expect((await registerWebhookSubscriptionController({})).statusCode).toBe(400);
    expect((await registerWebhookSubscriptionController(event("{nope"))).statusCode).toBe(400);
    expect((await registerWebhookSubscriptionController(event(null))).statusCode).toBe(400);
    expect((await registerWebhookSubscriptionController(event(JSON.stringify("just a string")))).statusCode).toBe(400);
    expect((await registerWebhookSubscriptionController(event(JSON.stringify({ ...requestBody, event_types: ["*"] })))).statusCode).toBe(400);
    expect(mockedRegister).not.toHaveBeenCalled();
  });

  it("maps service errors to 401, 400, 409 and 500", async () => {
    const cases: [unknown, number][] = [
      [new UnauthorizedError("bad key"), 401],
      [new ValidationError("host not allowed"), 400],
      [new ConflictError("cap reached"), 409],
      [new TerminalError("stale version"), 409],
      [new Error("boom"), 500],
      ["not an error", 500],
    ];
    for (const [error, status] of cases) {
      mockedRegister.mockRejectedValueOnce(error);
      expect((await registerWebhookSubscriptionController(event(JSON.stringify(requestBody)))).statusCode).toBe(status);
    }
  });
});
