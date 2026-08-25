import * as sns from "aws-cdk-lib/aws-sns";
import { Construct } from "constructs";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311OrderEventsTopicProps {
  envName: Nyc311Environment;
}

/**
 * Fan-out target for every appended `OrderEvent` (`5-order-evaluation.md`
 * §3) — the fan-out Lambda forwards every event unconditionally, tagged
 * with an `event_type` message attribute; subscribers filter declaratively
 * via a subscription filter policy rather than the fan-out Lambda deciding
 * relevance in code. No subscriptions yet — the evaluation leg
 * (`5-order-evaluation.md`'s Leg 2, a filtered SQS subscription) is the
 * first real subscriber, built in a later session.
 */
export class Nyc311OrderEventsTopic extends Construct {
  public readonly topic: sns.Topic;

  constructor(scope: Construct, id: string, props: Nyc311OrderEventsTopicProps) {
    super(scope, id);

    this.topic = new sns.Topic(this, "Topic", {
      topicName: `Nyc311OrderEvents-${ENV_NAME_SUFFIX[props.envName]}`,
      enforceSSL: true,
    });
  }
}
