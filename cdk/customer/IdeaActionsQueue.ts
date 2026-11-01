import { Duration } from "aws-cdk-lib";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import { CUSTOMER_ENV_SUFFIX } from "./customerConfig";

/* Above the action worker's 3-minute timeout, so a message isn't redelivered while it's still being worked. */
export const IDEA_ACTIONS_VISIBILITY_TIMEOUT = Duration.minutes(4);
/* A Bedrock throttle or a crash gets two more tries; each resumes from the saved steps. */
const MAX_RECEIVE_COUNT = 3;

/**
 * The hand-off from idea generation to actioning (docs/16-resident-action-models.md
 * §5.2): one `{ persona_id, idea_id }` message per new idea. Failures go to
 * a DLQ, with no alarm on it by choice.
 */
export class IdeaActionsQueue extends Construct {
  public readonly queue: sqs.Queue;
  public readonly deadLetterQueue: sqs.Queue;

  constructor(scope: Construct, id: string) {
    super(scope, id);
    this.deadLetterQueue = new sqs.Queue(this, "Dlq", {
      queueName: `IdeaActionsDlq-${CUSTOMER_ENV_SUFFIX}`,
      retentionPeriod: Duration.days(14),
      enforceSSL: true,
    });
    this.queue = new sqs.Queue(this, "Queue", {
      queueName: `IdeaActions-${CUSTOMER_ENV_SUFFIX}`,
      visibilityTimeout: IDEA_ACTIONS_VISIBILITY_TIMEOUT,
      deadLetterQueue: { queue: this.deadLetterQueue, maxReceiveCount: MAX_RECEIVE_COUNT },
      enforceSSL: true,
    });
  }
}
