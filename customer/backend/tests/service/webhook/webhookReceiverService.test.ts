import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { mockClient } from "aws-sdk-client-mock";
import { Webhook } from "standardwebhooks";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WebhookCustomerFacingOrderDao } from "../../../dao/webhookCustomerFacingOrder/webhookCustomerFacingOrderDao";
import { UnauthorizedError, ValidationError } from "../../../models/errors";
import type { SigningSecretStore } from "../../../service/webhook/signingSecretStore";
import { receiveBureauWebhook, type WebhookReceiverDeps } from "../../../service/webhook/webhookReceiverService";
import { SECRET, acceptedEvent, resolvedEvent } from "../../fixtures";

const NOW = new Date("2026-10-11T09:27:41.000Z");

/* Signed by the Standard Webhooks reference implementation, exactly as the bureau's deliveries are. */
function signed(webhookId: string, payload: unknown, at: Date = NOW): { headers: Record<string, string>; body: string } {
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  return {
    body,
    headers: {
      "webhook-id": webhookId,
      "webhook-timestamp": String(Math.floor(at.getTime() / 1000)),
      "webhook-signature": new Webhook(SECRET).sign(webhookId, at, body),
    },
  };
}

interface Mocks {
  deps: WebhookReceiverDeps;
  openOrder: ReturnType<typeof vi.fn>;
  closeOrder: ReturnType<typeof vi.fn>;
  getSecret: ReturnType<typeof vi.fn>;
}

function mocks(): Mocks {
  const openOrder = vi.fn().mockResolvedValue(true);
  const closeOrder = vi.fn().mockResolvedValue(undefined);
  const getSecret = vi.fn().mockResolvedValue(SECRET);
  return {
    deps: {
      webhookCustomerFacingOrderDao: { openOrder, closeOrder } as unknown as WebhookCustomerFacingOrderDao,
      secretStore: { getSecret } as unknown as SigningSecretStore,
      now: () => NOW,
    },
    openOrder,
    closeOrder,
    getSecret,
  };
}

beforeEach(() => {
  vi.stubEnv("CUSTOMER_SIGNING_SECRET_PARAMETER_NAME", "/customer/prod/webhook/signing-secret");
  vi.stubEnv("CUSTOMER_ORDERS_TABLE_NAME", "WebhookCustomerFacingOrders-Prod");
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("receiveBureauWebhook — ORDER_ACCEPTED", () => {
  it("opens the order with every public field and a 60-day expiry from acceptance", async () => {
    const m = mocks();
    const { headers, body } = signed("evt_01ORDER_1", acceptedEvent);
    await expect(receiveBureauWebhook(headers, body, m.deps)).resolves.toBe("OPENED");

    expect(m.getSecret).toHaveBeenCalledWith("/customer/prod/webhook/signing-secret");
    expect(m.openOrder).toHaveBeenCalledWith({
      order_id: "01ORDER",
      status: "OPEN",
      request_id: "01REQUEST",
      external_unique_key: "69860415",
      complaint_type: "Street Condition",
      descriptor: "Pothole",
      borough: "BROOKLYN",
      address: "412 ATLANTIC AVENUE",
      zip: "11217",
      reported_at: "2026-10-09T22:41:00.000",
      accepted_at: "2026-10-10T14:03:11.000Z",
      resolved_at: null,
      last_webhook_id: "evt_01ORDER_1",
      updated_at: NOW.toISOString(),
    });
    expect(m.closeOrder).not.toHaveBeenCalled();
  });

  it("reports a repeat, or an accept arriving after the resolve, as already known", async () => {
    const m = mocks();
    m.openOrder.mockResolvedValue(false);
    const { headers, body } = signed("evt_01ORDER_1", acceptedEvent);
    await expect(receiveBureauWebhook(headers, body, m.deps)).resolves.toBe("ALREADY_KNOWN");
  });

});

describe("receiveBureauWebhook — ORDER_RESOLVED", () => {
  it("closes the order, whether or not the accept ever arrived", async () => {
    const m = mocks();
    const { headers, body } = signed("evt_01ORDER_7", resolvedEvent);
    await expect(receiveBureauWebhook(headers, body, m.deps)).resolves.toBe("CLOSED");
    expect(m.closeOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        order_id: "01ORDER",
        status: "CLOSED",
        resolved_at: "2026-10-11T09:27:40.000Z",
        last_webhook_id: "evt_01ORDER_7",
      })
    );
    expect(m.openOrder).not.toHaveBeenCalled();
  });

  it("uses the event's own time when a resolve carries no resolved_at", async () => {
    const m = mocks();
    const { headers, body } = signed("evt_01ORDER_7", { ...resolvedEvent, data: acceptedEvent.data });
    await receiveBureauWebhook(headers, body, m.deps);
    expect(m.closeOrder).toHaveBeenCalledWith(expect.objectContaining({ status: "CLOSED", resolved_at: resolvedEvent.timestamp }));
  });
});

describe("receiveBureauWebhook — deliveries it will not apply", () => {
  it("acknowledges and ignores an event type it does not handle", async () => {
    const m = mocks();
    const { headers, body } = signed("evt_01ORDER_3", { ...acceptedEvent, type: "ORDER_SCHEDULED" });
    await expect(receiveBureauWebhook(headers, body, m.deps)).resolves.toBe("IGNORED");
    expect(m.openOrder).not.toHaveBeenCalled();
    expect(m.closeOrder).not.toHaveBeenCalled();
  });

  it("rejects a bad signature, a stale timestamp and a missing webhook-id before reading the body", async () => {
    const m = mocks();
    const good = signed("evt_01ORDER_1", acceptedEvent);
    await expect(receiveBureauWebhook(good.headers, `${good.body} `, m.deps)).rejects.toBeInstanceOf(UnauthorizedError);
    const stale = signed("evt_01ORDER_1", acceptedEvent, new Date(NOW.getTime() - 10 * 60_000));
    await expect(receiveBureauWebhook(stale.headers, stale.body, m.deps)).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(receiveBureauWebhook({ ...good.headers, "webhook-id": undefined }, good.body, m.deps)).rejects.toBeInstanceOf(UnauthorizedError);
    expect(m.openOrder).not.toHaveBeenCalled();
  });

  it("rejects a correctly signed body that is not JSON or not an event", async () => {
    const m = mocks();
    const notJson = signed("evt_x_1", "{nope");
    await expect(receiveBureauWebhook(notJson.headers, notJson.body, m.deps)).rejects.toBeInstanceOf(ValidationError);
    const wrongShape = signed("evt_x_2", { type: "ORDER_ACCEPTED", timestamp: "t", data: { order_id: "" } });
    await expect(receiveBureauWebhook(wrongShape.headers, wrongShape.body, m.deps)).rejects.toBeInstanceOf(ValidationError);
    expect(m.openOrder).not.toHaveBeenCalled();
  });
});

describe("receiveBureauWebhook — default dependencies", () => {
  it("builds its own DAO, secret store and clock", async () => {
    const ddbMock = mockClient(DynamoDBDocumentClient);
    const ssmMock = mockClient(SSMClient);
    ssmMock.on(GetParameterCommand).resolves({ Parameter: { Value: SECRET } });
    ddbMock.on(PutCommand).resolvesOnce({}).rejectsOnce(new ConditionalCheckFailedException({ message: "exists", $metadata: {} }));

    const first = signed("evt_01ORDER_1", acceptedEvent, new Date());
    await expect(receiveBureauWebhook(first.headers, first.body)).resolves.toBe("OPENED");
    await expect(receiveBureauWebhook(first.headers, first.body)).resolves.toBe("ALREADY_KNOWN");
    expect(ddbMock.commandCalls(PutCommand)[0].args[0].input.TableName).toBe("WebhookCustomerFacingOrders-Prod");
    ddbMock.restore();
    ssmMock.restore();
  });
});
