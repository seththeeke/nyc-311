import * as sns from "aws-cdk-lib/aws-sns";
import { Construct } from "constructs";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311OperatorEventsTopicProps {
  envName: Nyc311Environment;
}

/**
 * Fan-out target for every appended `OperatorEvent` row
 * (`7-data-warehousing.md` §4, Leg 6) —
 * `Nyc311OperatorsStreamFanOutLambda` publishes each `EVENT#` item here,
 * tagged with an `event_type` message attribute. The `operator_events`
 * warehouse Firehose is the only subscriber today — unlike
 * `Nyc311OrderEventsTopic`, there is no operational consumer.
 */
export class Nyc311OperatorEventsTopic extends Construct {
  public readonly topic: sns.Topic;

  constructor(scope: Construct, id: string, props: Nyc311OperatorEventsTopicProps) {
    super(scope, id);

    this.topic = new sns.Topic(this, "Topic", {
      topicName: `Nyc311OperatorEvents-${ENV_NAME_SUFFIX[props.envName]}`,
      enforceSSL: true,
    });
  }
}
