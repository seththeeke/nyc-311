import { Duration } from "aws-cdk-lib";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311OrderIngestionQueueProps {
  envName: Nyc311Environment;
}

/*
 * 3-order-ingestion.md §2.1/§2.3 — maxReceiveCount matches the
 * retryAttempts already chosen for the fan-out Lambda's own event source
 * mapping: one consistent retry budget across both hops of this pipeline.
 */
const MAX_RECEIVE_COUNT = 3;

/**
 * The standard SQS queue the fan-out Lambda publishes relevant `Request`s
 * onto (`3-order-ingestion.md` §2.1). Not consumed yet — the downstream
 * request-processor isn't built — but standing infrastructure regardless.
 * Standard, not FIFO: Requests are independent, and a downstream consumer
 * already tolerates redelivery. Its own redrive-to-DLQ preserves full
 * message content, unlike the fan-out Lambda's stream-metadata-only
 * `onFailure` (§2.3).
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
  }
}
