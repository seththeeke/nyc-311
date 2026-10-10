import { DynamoDBDocumentClient, GetCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OrderDao } from "../../../dao/order/orderDao";
import type { RequestDao } from "../../../dao/request/requestDao";
import type { WebhookSubscriptionDao } from "../../../dao/webhookSubscription/webhookSubscriptionDao";
import { TerminalError } from "../../../models/errors";
import type { OrderEvent } from "../../../models/order";
import { WebhookDeliveryTaskSchema } from "../../../models/webhookDeliveryTask";
import type { WebhookSubscription } from "../../../models/webhookSubscription";
import { dispatchWebhookEvent, webhookIdFor, type WebhookDispatchDeps } from "../../../service/webhook/webhookDispatchService";
import { orderEvent, subscription } from "./webhookTestFixtures";

const ACCEPTED = orderEvent("ORDER_ACCEPTED", 1, "2026-10-10T14:03:11.000Z");
const RESOLVED = orderEvent("ORDER_RESOLVED", 7, "2026-10-11T09:27:40.000Z");

const order = { order_id: "01ORDER", request_id: "01REQUEST" };
const request = {
  request_id: "01REQUEST",
  external_unique_key: "69860415",
  complaint_type: "Street Condition",
  descriptor: "Pothole",
  created_at: "2026-10-09T22:41:00.000",
  raw_payload: { borough: "BROOKLYN", incident_address: "412 ATLANTIC AVENUE", incident_zip: "11217" },
};

const sqsMock = mockClient(SQSClient);

interface Mocks {
  deps: WebhookDispatchDeps;
  getOrder: ReturnType<typeof vi.fn>;
  listOrderEvents: ReturnType<typeof vi.fn>;
  getRequestById: ReturnType<typeof vi.fn>;
}

function mocks(subscriptions: WebhookSubscription[] = [subscription], events: OrderEvent[] = [ACCEPTED, RESOLVED]): Mocks {
  const getOrder = vi.fn().mockResolvedValue(order);
  const listOrderEvents = vi.fn().mockResolvedValue(events);
  const getRequestById = vi.fn().mockResolvedValue(request);
  return {
    deps: {
      orderDao: { getOrder, listOrderEvents } as unknown as OrderDao,
      requestDao: { getRequestById } as unknown as RequestDao,
      webhookSubscriptionDao: { listSubscriptions: vi.fn().mockResolvedValue(subscriptions) } as unknown as WebhookSubscriptionDao,
      sqsClient: new SQSClient({}),
      deliveryQueueUrl: "https://sqs.test/delivery",
    },
    getOrder,
    listOrderEvents,
    getRequestById,
  };
}

function sentTasks(): unknown[] {
  return sqsMock.commandCalls(SendMessageCommand).map((call) => JSON.parse(call.args[0].input.MessageBody as string));
}

beforeEach(() => {
  sqsMock.reset();
  sqsMock.on(SendMessageCommand).resolves({});
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("webhookIdFor", () => {
  it("is built from the order id and event sequence", () => {
    expect(webhookIdFor(ACCEPTED)).toBe("evt_01ORDER_1");
  });
});

describe("dispatchWebhookEvent — ORDER_ACCEPTED", () => {
  it("enqueues one fat, public-safe delivery task for the subscription", async () => {
    const m = mocks();
    await expect(dispatchWebhookEvent(ACCEPTED, m.deps)).resolves.toBe(1);

    const [task] = sentTasks();
    expect(WebhookDeliveryTaskSchema.parse(task)).toEqual({
      webhook_id: "evt_01ORDER_1",
      subscription_id: "01SUB",
      event: {
        type: "ORDER_ACCEPTED",
        timestamp: ACCEPTED.occurred_at,
        data: {
          order_id: "01ORDER",
          request_id: "01REQUEST",
          external_unique_key: "69860415",
          complaint_type: "Street Condition",
          descriptor: "Pothole",
          borough: "BROOKLYN",
          address: "412 ATLANTIC AVENUE",
          zip: "11217",
          reported_at: "2026-10-09T22:41:00.000",
          accepted_at: ACCEPTED.occurred_at,
        },
      },
    });
    expect(sqsMock.commandCalls(SendMessageCommand)[0].args[0].input.QueueUrl).toBe("https://sqs.test/delivery");
    expect(m.listOrderEvents).not.toHaveBeenCalled();
  });

  it("sends nulls for address fields the 311 record lacks", async () => {
    const m = mocks();
    m.getRequestById.mockResolvedValue({ ...request, raw_payload: { borough: "", incident_zip: 11217 } });
    await dispatchWebhookEvent(ACCEPTED, m.deps);
    const task = WebhookDeliveryTaskSchema.parse(sentTasks()[0]);
    expect(task.event.data).toMatchObject({ borough: null, address: null, zip: null });
  });
});

describe("dispatchWebhookEvent — ORDER_RESOLVED", () => {
  it("carries the same order fields plus resolved_at, with accepted_at from the latest accept event", async () => {
    const earlierAccept = orderEvent("ORDER_ACCEPTED", 0, "2026-10-10T10:00:00.000Z");
    const m = mocks([subscription], [earlierAccept, ACCEPTED, RESOLVED]);
    await dispatchWebhookEvent(RESOLVED, m.deps);
    const task = WebhookDeliveryTaskSchema.parse(sentTasks()[0]);
    expect(task.webhook_id).toBe("evt_01ORDER_7");
    expect(task.event.type).toBe("ORDER_RESOLVED");
    expect(task.event.data.accepted_at).toBe(ACCEPTED.occurred_at);
    expect(task.event.data.resolved_at).toBe(RESOLVED.occurred_at);
  });

  it("skips an order that was never accepted", async () => {
    const m = mocks([subscription], [RESOLVED]);
    await expect(dispatchWebhookEvent(RESOLVED, m.deps)).resolves.toBe(0);
    expect(sentTasks()).toEqual([]);
  });
});

describe("dispatchWebhookEvent — choosing subscriptions", () => {
  it("fans out to every ACTIVE subscription that listed the event type, and no others", async () => {
    const wantsBoth = { ...subscription, subscription_id: "BOTH" };
    const acceptedOnly: WebhookSubscription = { ...subscription, subscription_id: "ACCEPT_ONLY", event_types: ["ORDER_ACCEPTED"] };
    const paused: WebhookSubscription = { ...subscription, subscription_id: "PAUSED", status: "PAUSED" };
    const m = mocks([wantsBoth, acceptedOnly, paused]);
    await expect(dispatchWebhookEvent(RESOLVED, m.deps)).resolves.toBe(1);
    expect(sentTasks().map((task) => (task as { subscription_id: string }).subscription_id)).toEqual(["BOTH"]);
    sqsMock.resetHistory();
    await expect(dispatchWebhookEvent(ACCEPTED, m.deps)).resolves.toBe(2);
    expect(m.getOrder).toHaveBeenCalledTimes(2);
  });

  it("does no order lookups when nothing is subscribed", async () => {
    const m = mocks([]);
    await expect(dispatchWebhookEvent(ACCEPTED, m.deps)).resolves.toBe(0);
    expect(m.getOrder).not.toHaveBeenCalled();
  });

  it("ignores an internal event type outside the public catalogue", async () => {
    const m = mocks();
    await expect(dispatchWebhookEvent(orderEvent("ORDER_SCHEDULED", 2, "2026-10-10T15:00:00.000Z"), m.deps)).resolves.toBe(0);
    expect(sentTasks()).toEqual([]);
  });
});

describe("dispatchWebhookEvent — missing records", () => {
  it("throws TerminalError when the Order or its Request is missing", async () => {
    const noOrder = mocks();
    noOrder.getOrder.mockResolvedValue(null);
    await expect(dispatchWebhookEvent(ACCEPTED, noOrder.deps)).rejects.toBeInstanceOf(TerminalError);
    const noRequest = mocks();
    noRequest.getRequestById.mockResolvedValue(null);
    await expect(dispatchWebhookEvent(ACCEPTED, noRequest.deps)).rejects.toBeInstanceOf(TerminalError);
    expect(sentTasks()).toEqual([]);
  });
});

describe("dispatchWebhookEvent — default dependencies", () => {
  it("builds its own DAOs and SQS client from the environment", async () => {
    vi.stubEnv("WEBHOOK_SUBSCRIPTIONS_TABLE_NAME", "WebhookSubscriptions");
    vi.stubEnv("WEBHOOK_DELIVERY_QUEUE_URL", "https://sqs.test/from-env");
    const ddbMock = mockClient(DynamoDBDocumentClient);
    ddbMock.on(ScanCommand).resolves({ Items: [subscription] });
    ddbMock.on(GetCommand, { TableName: "Orders" }).resolves({});
    await expect(dispatchWebhookEvent(ACCEPTED)).rejects.toBeInstanceOf(TerminalError);

    const fullOrder = {
      ...order,
      location_id: null,
      complaint_type: null,
      current_stage: "SCHEDULE",
      status: "ACTIVE",
      retry_counts: {},
      priority_tier: null,
      sla_deadline: null,
      scheduled_start: null,
      scheduled_end: null,
      assigned_operator_id: null,
      reassignment_count: 0,
      case_id: null,
      created_at: "2026-10-10T14:00:00.000Z",
      updated_at: "2026-10-10T14:03:11.000Z",
      last_event_sequence: 1,
    };
    const fullRequest = { ...request, source: "NYC_311", location_id: null, agency: null, status: "PROMOTED", created_by: null };
    ddbMock.on(GetCommand, { TableName: "Orders" }).resolves({ Item: fullOrder });
    ddbMock.on(GetCommand, { TableName: "Requests" }).resolves({ Item: fullRequest });
    await expect(dispatchWebhookEvent(ACCEPTED)).resolves.toBe(1);
    expect(sqsMock.commandCalls(SendMessageCommand)[0].args[0].input.QueueUrl).toBe("https://sqs.test/from-env");
    ddbMock.restore();
  });
});
