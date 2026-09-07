import * as sns from "aws-cdk-lib/aws-sns";
import { Construct } from "constructs";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311LocationEventsTopicProps {
  envName: Nyc311Environment;
}

/**
 * Fan-out target for every new `Location` row (`7-data-warehousing.md`
 * §4) — `Nyc311LocationsFanOutLambda` publishes each `INSERT` here, tagged
 * with an `event_name` message attribute. The `locations` warehouse
 * Firehose is the only subscriber today; more can attach without a
 * producer change.
 */
export class Nyc311LocationEventsTopic extends Construct {
  public readonly topic: sns.Topic;

  constructor(scope: Construct, id: string, props: Nyc311LocationEventsTopicProps) {
    super(scope, id);

    this.topic = new sns.Topic(this, "Topic", {
      topicName: `Nyc311LocationEvents-${ENV_NAME_SUFFIX[props.envName]}`,
      enforceSSL: true,
    });
  }
}
