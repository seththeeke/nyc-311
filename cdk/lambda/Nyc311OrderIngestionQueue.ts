import { Duration } from "aws-cdk-lib";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311OrderIngestionQueueProps {
  envName: Nyc311Environment;
}

// 3-order-ingestion.md §2.1/§2.3 — maxReceiveCount matches the
// retryAttempts already chosen for the fan-out Lambda's own event source
// mapping: one consistent retry budget across both hops of this pipeline.
const MAX_RECEIVE_COUNT = 3;

/**
 * The standard SQS queue the order-ingestion fan-out Lambda publishes
 * relevant `Request` records onto, per `3-order-ingestion.md` §2.1's
 * two-stage design. Not consumed by anything yet — the downstream
 * request-processor Lambda that reads from this queue isn't built yet
 * (out of scope for this slice) — but the queue itself is real,
 * standing infrastructure the fan-out Lambda needs to exist.
 *
 * Standard, not FIFO (agreed 2026-08-18): Requests are independent of each
 * other, nothing here needs ordering or exactly-once delivery, and a
 * downstream processor already has to tolerate redelivery/duplicates
 * regardless — this project already treats dedup as first-class
 * (`gsi1-external-key`, `1-data-ingestion.md` §2).
 *
 * Its own redrive-to-DLQ (unlike the fan-out Lambda's event-source-mapping
 * `onFailure`, which only ever carries stream metadata) preserves the full
 * message content — this is the piece of the design that actually solves
 * the "recover a failed record's real data" problem `3-order-ingestion.md`
 * §2.3 identified.
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
