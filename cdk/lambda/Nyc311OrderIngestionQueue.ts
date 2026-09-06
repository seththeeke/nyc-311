import { Duration } from "aws-cdk-lib";
import { SubscriptionFilter } from "aws-cdk-lib/aws-sns";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as subscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import { Construct } from "constructs";
import type { Nyc311RequestEventsTopic } from "./Nyc311RequestEventsTopic";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311OrderIngestionQueueProps {
  envName: Nyc311Environment;
  requestEventsTopic: Nyc311RequestEventsTopic;
}

/*
 * 3-order-ingestion.md §2.1/§2.3 — maxReceiveCount matches the
 * retryAttempts already chosen for the fan-out Lambda's own event source
 * mapping: one consistent retry budget across both hops of this pipeline.
 */
const MAX_RECEIVE_COUNT = 3;

/**
 * The standard SQS queue `Nyc311RequestEvaluationLambda` consumes from
 * (`3-order-ingestion.md` §3). Subscribed to {@link Nyc311RequestEventsTopic}
 * with a raw-delivery, `INSERT`-only filter policy — the unchanged "new
 * Requests only" criterion, moved from in-handler code to an SNS filter
 * policy (`7-data-warehousing.md` §4). Raw delivery keeps the SQS body the
 * plain `Request` JSON the controller already parses.
 */
export class Nyc311OrderIngestionQueue extends Construct {
  public readonly queue: sqs.Queue;
  public readonly deadLetterQueue: sqs.Queue;

  constructor(scope: Construct, id: string, props: Nyc311OrderIngestionQueueProps) {
    super(scope, id);

    const suffix = ENV_NAME_SUFFIX[props.envName];

    this.deadLetterQueue = new sqs.Queue(this, "Dlq", {
      queueName: `Nyc311OrderIngestionQueueDlq-${suffix}`,
      retentionPeriod: Duration.days(14),
      enforceSSL: true,
    });

    this.queue = new sqs.Queue(this, "Queue", {
      queueName: `Nyc311OrderIngestionQueue-${suffix}`,
      enforceSSL: true,
      deadLetterQueue: {
        queue: this.deadLetterQueue,
        maxReceiveCount: MAX_RECEIVE_COUNT,
      },
    });

    props.requestEventsTopic.topic.addSubscription(
      new subscriptions.SqsSubscription(this.queue, {
        rawMessageDelivery: true,
        filterPolicy: {
          event_name: SubscriptionFilter.stringFilter({ allowlist: ["INSERT"] }),
        },
      })
    );
  }
}
