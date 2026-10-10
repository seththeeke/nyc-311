import { DynamoDBDocumentClient, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WebhookSinkDeliveryDao } from "../../../dao/webhookSinkDelivery/webhookSinkDeliveryDao";
import { ValidationError } from "../../../models/errors";
import type { WebhookSinkDelivery } from "../../../models/webhookSinkDelivery";
import type { WebhookSecretStore } from "../../../service/webhook/webhookSecretStore";
import { buildWebhookHeaders } from "../../../service/webhook/webhookSignature";
import { SINK_LIST_LIMIT, listSinkDeliveries, receiveSinkDelivery, type WebhookSinkDeps } from "../../../service/webhook/webhookSinkService";
import { SECRET, webhookEvent } from "./webhookTestFixtures";

const NOW = new Date("2026-10-10T14:03:12.000Z");
const NOW_SECONDS = Math.floor(NOW.getTime() / 1000);
const BODY = JSON.stringify(webhookEvent);
const headers = buildWebhookHeaders({ secret: SECRET, webhookId: "evt_01ORDER_1", timestampSeconds: NOW_SECONDS, body: BODY });

function mocks(stored: WebhookSinkDelivery[] = []): { deps: WebhookSinkDeps; putDelivery: ReturnType<typeof vi.fn>; getSecret: ReturnType<typeof vi.fn> } {
  const putDelivery = vi.fn().mockResolvedValue(undefined);
  const getSecret = vi.fn().mockResolvedValue(SECRET);
  return {
    deps: {
      webhookSinkDeliveryDao: { putDelivery, listDeliveries: vi.fn().mockResolvedValue(stored) } as unknown as WebhookSinkDeliveryDao,
      secretStore: { getSecret } as unknown as WebhookSecretStore,
      now: () => NOW,
    },
    putDelivery,
    getSecret,
  };
}

beforeEach(() => {
  vi.stubEnv("WEBHOOK_SINK_SECRET_PARAMETER_NAME", "/nyc311/test/webhook-sink/secret");
  vi.stubEnv("WEBHOOK_SINK_DELIVERIES_TABLE_NAME", "WebhookSinkDeliveries");
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("receiveSinkDelivery", () => {
  it("records a signature-valid delivery with a one-week TTL", async () => {
    const m = mocks();
    await expect(receiveSinkDelivery(headers, BODY, m.deps)).resolves.toBe(true);
    expect(m.getSecret).toHaveBeenCalledWith("/nyc311/test/webhook-sink/secret");
    expect(m.putDelivery).toHaveBeenCalledWith({
      webhook_id: "evt_01ORDER_1",
      event_type: "ORDER_ACCEPTED",
      received_at: NOW.toISOString(),
      signature_valid: true,
      expires_at: NOW_SECONDS + 7 * 24 * 60 * 60,
    });
  });

  it("records, and reports, a delivery whose signature does not verify", async () => {
    const m = mocks();
    await expect(receiveSinkDelivery(headers, `${BODY} `, m.deps)).resolves.toBe(false);
    expect(m.putDelivery).toHaveBeenCalledWith(expect.objectContaining({ signature_valid: false }));
  });

  it("records a null event type for a body with no readable type", async () => {
    for (const body of ["not json", "[]", "null", JSON.stringify({ type: 7 }), JSON.stringify({ type: "" })]) {
      const m = mocks();
      await receiveSinkDelivery(headers, body, m.deps);
      expect(m.putDelivery).toHaveBeenCalledWith(expect.objectContaining({ event_type: null }));
    }
  });

  it("rejects a delivery with no webhook-id before touching SSM", async () => {
    const m = mocks();
    await expect(receiveSinkDelivery({}, BODY, m.deps)).rejects.toBeInstanceOf(ValidationError);
    expect(m.getSecret).not.toHaveBeenCalled();
  });
});

describe("listSinkDeliveries", () => {
  it("returns the newest deliveries first, capped", async () => {
    const stored: WebhookSinkDelivery[] = Array.from({ length: SINK_LIST_LIMIT + 5 }, (_, index) => ({
      webhook_id: `evt_${index}`,
      event_type: "ORDER_ACCEPTED",
      received_at: new Date(NOW.getTime() - index * 60_000).toISOString(),
      signature_valid: true,
      expires_at: NOW_SECONDS + 1000,
    })).reverse();
    const deliveries = await listSinkDeliveries(mocks(stored).deps);
    expect(deliveries).toHaveLength(SINK_LIST_LIMIT);
    expect(deliveries[0].webhook_id).toBe("evt_0");
    expect(deliveries[1].webhook_id).toBe("evt_1");
  });
});

describe("webhookSinkService — default dependencies", () => {
  it("builds its own DAO, secret store and clock", async () => {
    const ddbMock = mockClient(DynamoDBDocumentClient);
    const ssmMock = mockClient(SSMClient);
    ddbMock.on(PutCommand).resolves({});
    ddbMock.on(ScanCommand).resolves({ Items: [] });
    ssmMock.on(GetParameterCommand).resolves({ Parameter: { Value: SECRET } });
    const fresh = buildWebhookHeaders({ secret: SECRET, webhookId: "evt_now", timestampSeconds: Math.floor(Date.now() / 1000), body: BODY });

    await expect(receiveSinkDelivery(fresh, BODY)).resolves.toBe(true);
    await expect(listSinkDeliveries()).resolves.toEqual([]);
    expect(ddbMock.commandCalls(PutCommand)[0].args[0].input.TableName).toBe("WebhookSinkDeliveries");
    ddbMock.restore();
    ssmMock.restore();
  });
});
