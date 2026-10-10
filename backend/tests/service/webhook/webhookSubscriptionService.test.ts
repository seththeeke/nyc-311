import { DynamoDBDocumentClient, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { GetParameterCommand, PutParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WebhookSubscriptionDao } from "../../../dao/webhookSubscription/webhookSubscriptionDao";
import { ConflictError, UnauthorizedError, ValidationError } from "../../../models/errors";
import type { WebhookSubscription } from "../../../models/webhookSubscription";
import type { WebhookSecretStore } from "../../../service/webhook/webhookSecretStore";
import { registerWebhookSubscription, type WebhookSubscriptionServiceDeps } from "../../../service/webhook/webhookSubscriptionService";
import { SECRET, subscription } from "./webhookTestFixtures";

const KEY = "registration-key-value";
const NOW = new Date("2026-10-11T08:00:00.000Z");
const request = {
  name: "the-customer",
  callback_url: subscription.callback_url,
  event_types: ["ORDER_ACCEPTED" as const],
  secret: SECRET,
};

interface Mocks {
  deps: WebhookSubscriptionServiceDeps;
  listSubscriptions: ReturnType<typeof vi.fn>;
  createSubscription: ReturnType<typeof vi.fn>;
  replaceSubscription: ReturnType<typeof vi.fn>;
  getSecret: ReturnType<typeof vi.fn>;
  putSecret: ReturnType<typeof vi.fn>;
}

function mocks(existing: WebhookSubscription[] = []): Mocks {
  const listSubscriptions = vi.fn().mockResolvedValue(existing);
  const createSubscription = vi.fn().mockResolvedValue(undefined);
  const replaceSubscription = vi.fn().mockResolvedValue(undefined);
  const getSecret = vi.fn().mockResolvedValue(KEY);
  const putSecret = vi.fn().mockResolvedValue(undefined);
  return {
    deps: {
      webhookSubscriptionDao: { listSubscriptions, createSubscription, replaceSubscription } as unknown as WebhookSubscriptionDao,
      secretStore: { getSecret, putSecret } as unknown as WebhookSecretStore,
      now: () => NOW,
      newId: () => "01NEW",
    },
    listSubscriptions,
    createSubscription,
    replaceSubscription,
    getSecret,
    putSecret,
  };
}

beforeEach(() => {
  vi.stubEnv("WEBHOOK_SSM_PREFIX", "/nyc311/test/webhook");
  vi.stubEnv("WEBHOOK_ALLOWED_CALLBACK_HOSTS", "customer-api.boroughsim.com, api.test.boroughsim.com");
  vi.stubEnv("WEBHOOK_SUBSCRIPTIONS_TABLE_NAME", "WebhookSubscriptions");
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("registerWebhookSubscription — the registration key", () => {
  it("rejects a missing key without reading the stored one, and a wrong key after reading it", async () => {
    const m = mocks();
    await expect(registerWebhookSubscription(request, undefined, m.deps)).rejects.toBeInstanceOf(UnauthorizedError);
    expect(m.getSecret).not.toHaveBeenCalled();
    await expect(registerWebhookSubscription(request, "wrong", m.deps)).rejects.toBeInstanceOf(UnauthorizedError);
    expect(m.getSecret).toHaveBeenCalledWith("/nyc311/test/webhook/registration-key");
    expect(m.listSubscriptions).not.toHaveBeenCalled();
  });
});

describe("registerWebhookSubscription — the callback URL", () => {
  it("rejects an unparseable URL, a non-https URL and a host off the allowlist", async () => {
    const m = mocks();
    for (const callbackUrl of ["not a url", "http://customer-api.boroughsim.com/hook", "https://evil.example.com/hook"]) {
      await expect(registerWebhookSubscription({ ...request, callback_url: callbackUrl }, KEY, m.deps)).rejects.toBeInstanceOf(ValidationError);
    }
    expect(m.listSubscriptions).not.toHaveBeenCalled();
  });

  it("matches the allowlist case-insensitively", async () => {
    const m = mocks();
    const result = await registerWebhookSubscription({ ...request, callback_url: "https://API.TEST.boroughsim.com/webhook-sink" }, KEY, m.deps);
    expect(result.created).toBe(true);
  });
});

describe("registerWebhookSubscription — a new callback URL", () => {
  it("creates an ACTIVE row, then stores the secret, and never returns where it is stored", async () => {
    const m = mocks();
    const result = await registerWebhookSubscription(request, KEY, m.deps);

    const expectedRow: WebhookSubscription = {
      subscription_id: "01NEW",
      name: "the-customer",
      callback_url: subscription.callback_url,
      event_types: ["ORDER_ACCEPTED"],
      status: "ACTIVE",
      secret_parameter_name: "/nyc311/test/webhook/01NEW/secret",
      version: 1,
      created_at: NOW.toISOString(),
      updated_at: NOW.toISOString(),
    };
    expect(m.createSubscription).toHaveBeenCalledWith(expectedRow);
    expect(m.putSecret).toHaveBeenCalledWith("/nyc311/test/webhook/01NEW/secret", SECRET);
    expect(m.createSubscription.mock.invocationCallOrder[0]).toBeLessThan(m.putSecret.mock.invocationCallOrder[0]);
    expect(result.created).toBe(true);
    expect(result.subscription).not.toHaveProperty("secret_parameter_name");
    expect(result.subscription.subscription_id).toBe("01NEW");
  });

  it("refuses once the subscription cap is reached", async () => {
    const full = Array.from({ length: 25 }, (_, index) => ({
      ...subscription,
      subscription_id: `SUB${index}`,
      callback_url: `https://customer-api.boroughsim.com/hook/${index}`,
    }));
    const m = mocks(full);
    await expect(registerWebhookSubscription(request, KEY, m.deps)).rejects.toBeInstanceOf(ConflictError);
    expect(m.createSubscription).not.toHaveBeenCalled();
  });
});

describe("registerWebhookSubscription — a callback URL already registered", () => {
  it("overwrites name, event types and secret, bumps the version, and leaves a pause in place", async () => {
    const paused: WebhookSubscription = { ...subscription, status: "PAUSED", version: 3 };
    const m = mocks([paused]);
    const result = await registerWebhookSubscription({ ...request, name: "renamed" }, KEY, m.deps);

    expect(m.replaceSubscription).toHaveBeenCalledWith(
      { ...paused, name: "renamed", event_types: ["ORDER_ACCEPTED"], version: 4, updated_at: NOW.toISOString() },
      3
    );
    expect(m.putSecret).toHaveBeenCalledWith(paused.secret_parameter_name, SECRET);
    expect(m.createSubscription).not.toHaveBeenCalled();
    expect(result).toEqual({
      created: false,
      subscription: expect.objectContaining({ subscription_id: "01SUB", status: "PAUSED", version: 4, name: "renamed" }),
    });
  });
});

describe("registerWebhookSubscription — default dependencies", () => {
  it("builds its own DAO, secret store, clock and id", async () => {
    const ddbMock = mockClient(DynamoDBDocumentClient);
    const ssmMock = mockClient(SSMClient);
    ddbMock.on(ScanCommand).resolves({ Items: [] });
    ddbMock.on(PutCommand).resolves({});
    ssmMock.on(GetParameterCommand).resolves({ Parameter: { Value: KEY } });
    ssmMock.on(PutParameterCommand).resolves({});

    const result = await registerWebhookSubscription(request, KEY);

    expect(result.created).toBe(true);
    expect(ddbMock.commandCalls(PutCommand)[0].args[0].input.TableName).toBe("WebhookSubscriptions");
    expect(ssmMock.commandCalls(PutParameterCommand)[0].args[0].input.Name).toBe(
      `/nyc311/test/webhook/${result.subscription.subscription_id}/secret`
    );
    ddbMock.restore();
    ssmMock.restore();
  });
});
