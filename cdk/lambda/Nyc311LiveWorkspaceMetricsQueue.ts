import { Duration } from "aws-cdk-lib";
import { SubscriptionFilter } from "aws-cdk-lib/aws-sns";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as subscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import { Construct } from "constructs";
import type { Nyc311OrderEventsTopic } from "./Nyc311OrderEventsTopic";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311LiveWorkspaceMetricsQueueProps {
  envName: Nyc311Environment;
  orderEventsTopic: Nyc311OrderEventsTopic;
}

/* Same retry budget as every other queue in this project (3-order-ingestion.md §2.1/§2.3). */
const MAX_RECEIVE_COUNT = 3;

/**
 * The standard SQS queue the live-workspace-metrics Lambda consumes from —
 * subscribed to {@link Nyc311OrderEventsTopic} with a filter policy that
 * delivers only `ORDER_ACCEPTED` and `ORDER_RESOLVED`, the two events the
 * secondary workspace's five live tiles derive from. Raw message
 * delivery, so the controller parses each body directly as an
 * `OrderEvent`. A message in the DLQ is a tile count that is now short.
 */
export class Nyc311LiveWorkspaceMetricsQueue extends Construct {
  public readonly queue: sqs.Queue;
  public readonly deadLetterQueue: sqs.Queue;

  constructor(scope: Construct, id: string, props: Nyc311LiveWorkspaceMetricsQueueProps) {
    super(scope, id);

    const suffix = ENV_NAME_SUFFIX[props.envName];

    this.deadLetterQueue = new sqs.Queue(this, "Dlq", {
      queueName: `Nyc311LiveWorkspaceMetricsQueueDlq-${suffix}`,
      retentionPeriod: Duration.days(14),
      enforceSSL: true,
    });

    this.queue = new sqs.Queue(this, "Queue", {
      queueName: `Nyc311LiveWorkspaceMetricsQueue-${suffix}`,
      enforceSSL: true,
      deadLetterQueue: {
        queue: this.deadLetterQueue,
        maxReceiveCount: MAX_RECEIVE_COUNT,
      },
    });

    props.orderEventsTopic.topic.addSubscription(
      new subscriptions.SqsSubscription(this.queue, {
        rawMessageDelivery: true,
        filterPolicy: {
          event_type: SubscriptionFilter.stringFilter({ allowlist: ["ORDER_ACCEPTED", "ORDER_RESOLVED"] }),
        },
      })
    );
  }
}
