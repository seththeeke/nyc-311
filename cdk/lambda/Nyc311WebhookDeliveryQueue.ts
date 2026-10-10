import { Duration } from "aws-cdk-lib";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311WebhookDeliveryQueueProps {
  envName: Nyc311Environment;
}

/*
 * The whole webhook retry policy, as configuration
 * (13-customer-simulation.md §5): a failed delivery becomes visible again
 * after 30 minutes and is tried 48 times — about a day — before it is
 * dead-lettered. No backoff and no retry code in the Lambda.
 */
export const WEBHOOK_RETRY_INTERVAL = Duration.minutes(30);
export const WEBHOOK_MAX_DELIVERY_ATTEMPTS = 48;

/**
 * One message per (public event, subscription), written by the dispatch
 * Lambda and consumed by the delivery Lambda. Retries and dead-lettering
 * are therefore per subscriber. A message in the DLQ is a delivery that
 * failed for a full day; SQS redrive sends it again.
 */
export class Nyc311WebhookDeliveryQueue extends Construct {
  public readonly queue: sqs.Queue;
  public readonly deadLetterQueue: sqs.Queue;

  constructor(scope: Construct, id: string, props: Nyc311WebhookDeliveryQueueProps) {
    super(scope, id);

    const suffix = ENV_NAME_SUFFIX[props.envName];

    this.deadLetterQueue = new sqs.Queue(this, "Dlq", {
      queueName: `Nyc311WebhookDeliveryQueueDlq-${suffix}`,
      retentionPeriod: Duration.days(14),
      enforceSSL: true,
    });

    this.queue = new sqs.Queue(this, "Queue", {
      queueName: `Nyc311WebhookDeliveryQueue-${suffix}`,
      enforceSSL: true,
      visibilityTimeout: WEBHOOK_RETRY_INTERVAL,
      deadLetterQueue: {
        queue: this.deadLetterQueue,
        maxReceiveCount: WEBHOOK_MAX_DELIVERY_ATTEMPTS,
      },
    });
  }
}
