import { Duration } from "aws-cdk-lib";
import { SubscriptionFilter } from "aws-cdk-lib/aws-sns";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as subscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import { Construct } from "constructs";
import type { Nyc311OrderEventsTopic } from "./Nyc311OrderEventsTopic";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311OrderEvaluationQueueProps {
  envName: Nyc311Environment;
  orderEventsTopic: Nyc311OrderEventsTopic;
}

/* Same retry budget as every other queue in this project (3-order-ingestion.md §2.1/§2.3). */
const MAX_RECEIVE_COUNT = 3;

/**
 * The standard SQS queue the evaluation Lambda consumes from
 * (`5-order-evaluation.md` §3/§6) — subscribed to
 * {@link Nyc311OrderEventsTopic} with a filter policy that only ever
 * delivers `ORDER_CREATED` events, so the evaluator never re-triggers on
 * its own `ORDER_ACCEPTED`/`ORDER_REJECTED`/`CASE_CREATED` outcome events.
 * Raw message delivery is enabled — the evaluator's controller parses the
 * SQS message body directly as an `OrderEvent`, no SNS envelope to unwrap.
 */
export class Nyc311OrderEvaluationQueue extends Construct {
  public readonly queue: sqs.Queue;
  public readonly deadLetterQueue: sqs.Queue;

  constructor(scope: Construct, id: string, props: Nyc311OrderEvaluationQueueProps) {
    super(scope, id);

    const suffix = ENV_NAME_SUFFIX[props.envName];

    this.deadLetterQueue = new sqs.Queue(this, "Dlq", {
      queueName: `Nyc311OrderEvaluationQueueDlq-${suffix}`,
      retentionPeriod: Duration.days(14),
      enforceSSL: true,
    });

    this.queue = new sqs.Queue(this, "Queue", {
      queueName: `Nyc311OrderEvaluationQueue-${suffix}`,
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
          event_type: SubscriptionFilter.stringFilter({ allowlist: ["ORDER_CREATED"] }),
        },
      })
    );
  }
}
