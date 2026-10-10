import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { requireEnv } from "../../env";
import { logInfo, logWarn } from "../../logger";
import { OrderDao } from "../../dao/order/orderDao";
import { RequestDao } from "../../dao/request/requestDao";
import { WebhookSubscriptionDao } from "../../dao/webhookSubscription/webhookSubscriptionDao";
import { TerminalError } from "../../models/errors";
import type { OrderEvent } from "../../models/order";
import type { WebhookDeliveryTask } from "../../models/webhookDeliveryTask";
import type { WebhookEvent } from "../../models/webhookEvent";
import { WEBHOOK_EVENT_TYPES, type WebhookEventType } from "../../models/webhookSubscription";

/* All constructed lazily, per function that needs one (CLAUDE.md §5.2) — never a module-scope singleton. */
function getDocumentClient(): DynamoDBDocumentClient {
  return DynamoDBDocumentClient.from(new DynamoDBClient({}));
}

export interface WebhookDispatchDeps {
  orderDao?: OrderDao;
  requestDao?: RequestDao;
  webhookSubscriptionDao?: WebhookSubscriptionDao;
  sqsClient?: SQSClient;
  deliveryQueueUrl?: string;
}

/** `evt_<order_id>_<sequence_number>` — identical on every retry and for every subscriber. */
export function webhookIdFor(orderEvent: OrderEvent): string {
  return `evt_${orderEvent.order_id}_${orderEvent.sequence_number}`;
}

function isPublicEventType(eventType: string): eventType is WebhookEventType {
  return (WEBHOOK_EVENT_TYPES as readonly string[]).includes(eventType);
}

function stringField(payload: Record<string, unknown>, field: string): string | null {
  const value = payload[field];
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * When the Order was accepted: the event's own time for ORDER_ACCEPTED,
 * otherwise its latest ORDER_ACCEPTED event. `null` means it never was,
 * so subscribers were never told it was in play.
 */
async function acceptedAtFor(orderEvent: OrderEvent, orderDao: OrderDao): Promise<string | null> {
  if (orderEvent.event_type === "ORDER_ACCEPTED") return orderEvent.occurred_at;
  const events = await orderDao.listOrderEvents(orderEvent.order_id);
  const accepted = events
    .filter((event) => event.event_type === "ORDER_ACCEPTED")
    .sort((a, b) => b.sequence_number - a.sequence_number)[0];
  return accepted ? accepted.occurred_at : null;
}

/**
 * Maps an internal `OrderEvent` onto the public payload — only the
 * public-safe fields, taken from the Order and the originating Request's
 * own 311 record.
 *
 * @returns `null` for an Order that was never accepted.
 * @throws {@link TerminalError} if the Order or its Request is missing.
 */
async function buildWebhookEvent(orderEvent: OrderEvent, eventType: WebhookEventType, deps: WebhookDispatchDeps): Promise<WebhookEvent | null> {
  const orderDao = deps.orderDao ?? new OrderDao(getDocumentClient(), requireEnv("ORDERS_TABLE_NAME"));
  const requestDao = deps.requestDao ?? new RequestDao(getDocumentClient(), requireEnv("REQUESTS_TABLE_NAME"));

  const order = await orderDao.getOrder(orderEvent.order_id);
  if (!order) {
    throw new TerminalError(`Order ${orderEvent.order_id} not found while building a webhook event`);
  }
  const request = await requestDao.getRequestById(order.request_id);
  if (!request) {
    throw new TerminalError(`Request ${order.request_id} not found while building a webhook event`);
  }
  const acceptedAt = await acceptedAtFor(orderEvent, orderDao);
  if (acceptedAt === null) {
    logWarn("WebhookDispatchOrderNeverAccepted", { orderId: orderEvent.order_id, eventType });
    return null;
  }

  return {
    type: eventType,
    timestamp: orderEvent.occurred_at,
    data: {
      order_id: order.order_id,
      request_id: request.request_id,
      external_unique_key: request.external_unique_key,
      complaint_type: request.complaint_type,
      descriptor: request.descriptor,
      borough: stringField(request.raw_payload, "borough"),
      address: stringField(request.raw_payload, "incident_address"),
      zip: stringField(request.raw_payload, "incident_zip"),
      reported_at: request.created_at,
      accepted_at: acceptedAt,
      ...(eventType === "ORDER_RESOLVED" ? { resolved_at: orderEvent.occurred_at } : {}),
    },
  };
}

/**
 * Fans one internal `OrderEvent` out to the delivery queue — one message
 * per `ACTIVE` subscription that listed the event's type. The payload is
 * built once here and frozen into each message.
 *
 * @returns How many delivery messages were enqueued.
 */
export async function dispatchWebhookEvent(orderEvent: OrderEvent, deps: WebhookDispatchDeps = {}): Promise<number> {
  const eventType = orderEvent.event_type;
  logInfo("WebhookDispatchStarted", { orderId: orderEvent.order_id, eventType, sequenceNumber: orderEvent.sequence_number });
  if (!isPublicEventType(eventType)) {
    logWarn("WebhookDispatchEventTypeNotPublic", { orderId: orderEvent.order_id, eventType });
    return 0;
  }

  const subscriptionDao =
    deps.webhookSubscriptionDao ?? new WebhookSubscriptionDao(getDocumentClient(), requireEnv("WEBHOOK_SUBSCRIPTIONS_TABLE_NAME"));
  const subscriptions = await subscriptionDao.listSubscriptions();
  const targets = subscriptions.filter((subscription) => subscription.status === "ACTIVE" && subscription.event_types.includes(eventType));
  logInfo("WebhookDispatchTargetsResolved", {
    orderId: orderEvent.order_id,
    eventType,
    subscriptionCount: subscriptions.length,
    targetIds: targets.map((subscription) => subscription.subscription_id),
  });
  if (targets.length === 0) return 0;

  const event = await buildWebhookEvent(orderEvent, eventType, deps);
  if (event === null) return 0;

  const sqsClient = deps.sqsClient ?? new SQSClient({});
  const queueUrl = deps.deliveryQueueUrl ?? requireEnv("WEBHOOK_DELIVERY_QUEUE_URL");
  const webhookId = webhookIdFor(orderEvent);
  for (const subscription of targets) {
    const task: WebhookDeliveryTask = { webhook_id: webhookId, subscription_id: subscription.subscription_id, event };
    await sqsClient.send(new SendMessageCommand({ QueueUrl: queueUrl, MessageBody: JSON.stringify(task) }));
    logInfo("WebhookDeliveryEnqueued", { webhookId, subscriptionId: subscription.subscription_id, eventType });
  }
  return targets.length;
}
