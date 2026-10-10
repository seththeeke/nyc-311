import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { mockClient } from "aws-sdk-client-mock";
import { Webhook } from "standardwebhooks";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WebhookSubscriptionDao } from "../../../dao/webhookSubscription/webhookSubscriptionDao";
import type { WebhookDeliveryTask } from "../../../models/webhookDeliveryTask";
import type { WebhookSubscription } from "../../../models/webhookSubscription";
import type { WebhookSecretStore } from "../../../service/webhook/webhookSecretStore";
import { deliverWebhook, type WebhookDeliveryDeps } from "../../../service/webhook/webhookDeliveryService";
import { SECRET, subscription, webhookEvent } from "./webhookTestFixtures";

const task: WebhookDeliveryTask = { webhook_id: "evt_01ORDER_1", subscription_id: "01SUB", event: webhookEvent };

interface Mocks {
  deps: WebhookDeliveryDeps;
  fetchFn: ReturnType<typeof vi.fn>;
  getSecret: ReturnType<typeof vi.fn>;
}

function mocks(stored: WebhookSubscription | null = subscription, status = 200): Mocks {
  const fetchFn = vi.fn().mockResolvedValue({ status });
  const getSecret = vi.fn().mockResolvedValue(SECRET);
  return {
    deps: {
      webhookSubscriptionDao: { getSubscription: vi.fn().mockResolvedValue(stored) } as unknown as WebhookSubscriptionDao,
      secretStore: { getSecret } as unknown as WebhookSecretStore,
      fetchFn: fetchFn as unknown as typeof fetch,
      now: () => new Date(),
    },
    fetchFn,
    getSecret,
  };
}

let errorSpy: ReturnType<typeof vi.spyOn>;
let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("deliverWebhook — a successful attempt", () => {
  it("POSTs the event with headers the Standard Webhooks reference verifies", async () => {
    const m = mocks();
    await expect(deliverWebhook(task, 1, m.deps)).resolves.toBe("DELIVERED");

    const [url, init] = m.fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(subscription.callback_url);
    expect(init.method).toBe("POST");
    expect(init.redirect).toBe("manual");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(init.body as string)).toEqual(webhookEvent);
    const headers = init.headers as Record<string, string>;
    expect(headers["webhook-id"]).toBe("evt_01ORDER_1");
    expect(() => new Webhook(SECRET).verify(init.body as string, headers)).not.toThrow();
    expect(m.getSecret).toHaveBeenCalledWith(subscription.secret_parameter_name);
  });

  it("logs one attempt line with the attempt number, status and outcome, and never the secret", async () => {
    const m = mocks(subscription, 204);
    await deliverWebhook(task, 3, m.deps);
    const lines = logSpy.mock.calls.map((call) => JSON.parse(call[0] as string));
    const attempt = lines.find((line) => line.message === "WebhookDeliveryAttempt");
    expect(attempt).toMatchObject({ outcome: "DELIVERED", status: 204, attempt: 3, subscriptionId: "01SUB", webhookId: "evt_01ORDER_1" });
    expect(JSON.stringify(logSpy.mock.calls)).not.toContain(SECRET);
  });
});

describe("deliverWebhook — dropped without sending", () => {
  it("drops a delivery for a paused or deleted subscription", async () => {
    const paused = mocks({ ...subscription, status: "PAUSED" });
    await expect(deliverWebhook(task, 1, paused.deps)).resolves.toBe("DROPPED");
    const deleted = mocks(null);
    await expect(deliverWebhook(task, 1, deleted.deps)).resolves.toBe("DROPPED");
    expect(paused.fetchFn).not.toHaveBeenCalled();
    expect(deleted.fetchFn).not.toHaveBeenCalled();
    expect(paused.getSecret).not.toHaveBeenCalled();
  });
});

describe("deliverWebhook — a failed attempt", () => {
  it("throws for any non-2xx status, including a redirect", async () => {
    for (const status of [199, 301, 404, 500]) {
      const m = mocks(subscription, status);
      await expect(deliverWebhook(task, 2, m.deps)).rejects.toThrow(`returned ${status}`);
    }
    const line = JSON.parse(errorSpy.mock.calls[0][0] as string);
    expect(line).toMatchObject({ message: "WebhookDeliveryAttempt", outcome: "FAILED", status: 199, attempt: 2 });
  });

  it("throws for a timeout or network error, whatever was thrown", async () => {
    const m = mocks();
    m.fetchFn.mockRejectedValueOnce(new Error("The operation was aborted due to timeout")).mockRejectedValueOnce("socket hang up");
    await expect(deliverWebhook(task, 1, m.deps)).rejects.toThrow("aborted due to timeout");
    await expect(deliverWebhook(task, 1, m.deps)).rejects.toThrow("socket hang up");
    const line = JSON.parse(errorSpy.mock.calls[0][0] as string);
    expect(line).toMatchObject({ message: "WebhookDeliveryAttempt", outcome: "FAILED", status: null });
  });
});

describe("deliverWebhook — default dependencies", () => {
  it("builds its own DAO and secret store, and uses global fetch", async () => {
    vi.stubEnv("WEBHOOK_SUBSCRIPTIONS_TABLE_NAME", "WebhookSubscriptions");
    const ddbMock = mockClient(DynamoDBDocumentClient);
    const ssmMock = mockClient(SSMClient);
    ddbMock.on(GetCommand).resolves({ Item: subscription });
    ssmMock.on(GetParameterCommand).resolves({ Parameter: { Value: SECRET } });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({ status: 200 } as Response);

    await expect(deliverWebhook(task, 1)).resolves.toBe("DELIVERED");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(ddbMock.commandCalls(GetCommand)[0].args[0].input.TableName).toBe("WebhookSubscriptions");
    ddbMock.restore();
    ssmMock.restore();
  });
});
