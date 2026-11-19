import { Duration } from "aws-cdk-lib";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import type { Construct } from "constructs";
import type { OrdersTable } from "../data/OrdersTable";
import type { RequestsTable } from "../data/RequestsTable";
import type { WebhookSubscriptionsTable } from "../data/WebhookSubscriptionsTable";
import type { Nyc311WebhookDeliveryQueue } from "./Nyc311WebhookDeliveryQueue";
import type { Nyc311WebhookDispatchQueue } from "./Nyc311WebhookDispatchQueue";
import type { Nyc311Environment } from "../stack/Nyc311Stack";
import { Nyc311Function } from "./Nyc311Function";

export interface Nyc311WebhookDispatchLambdaProps {
  envName: Nyc311Environment;
  ordersTable: OrdersTable;
  requestsTable: RequestsTable;
  webhookSubscriptionsTable: WebhookSubscriptionsTable;
  webhookDispatchQueue: Nyc311WebhookDispatchQueue;
  webhookDeliveryQueue: Nyc311WebhookDeliveryQueue;
}

/* A few key reads and one SendMessage per subscription, same sizing as Nyc311LiveWorkspaceMetricsLambda. */
const BATCH_SIZE = 10;

/**
 * Turns each accepted/resolved `OrderEvent` into the public webhook
 * payload and enqueues one delivery message per `ACTIVE` subscription
 * (`13-customer-simulation.md` §3 Flow A). Entry point is
 * `backend/controller/webhook/dispatchWebhookEventController.ts`.
 */
export class Nyc311WebhookDispatchLambda extends Nyc311Function {
  constructor(scope: Construct, id: string, props: Nyc311WebhookDispatchLambdaProps) {
    super(scope, id, {
      envName: props.envName,
      name: "Nyc311WebhookDispatch",
      entry: ["controller", "webhook", "dispatchWebhookEventController.ts"],
      handler: "dispatchWebhookEventController",
      timeout: Duration.seconds(30),
      memorySize: 256,
      environment: {
        ORDERS_TABLE_NAME: props.ordersTable.tableName,
        REQUESTS_TABLE_NAME: props.requestsTable.tableName,
        WEBHOOK_SUBSCRIPTIONS_TABLE_NAME: props.webhookSubscriptionsTable.tableName,
        WEBHOOK_DELIVERY_QUEUE_URL: props.webhookDeliveryQueue.queue.queueUrl,
      },
    });

    this.addEventSource(
      new SqsEventSource(props.webhookDispatchQueue.queue, {
        batchSize: BATCH_SIZE,
        reportBatchItemFailures: true,
      })
    );

    /* Least privilege: one Order (GetItem) and its events (Query), its Request (GetItem), the capped subscription Scan, and SendMessage. */
    props.ordersTable.grant(this, "dynamodb:GetItem", "dynamodb:Query");
    props.requestsTable.grant(this, "dynamodb:GetItem");
    props.webhookSubscriptionsTable.grant(this, "dynamodb:Scan");
    props.webhookDeliveryQueue.queue.grantSendMessages(this);
  }
}
