import * as sns from "aws-cdk-lib/aws-sns";
import { Construct } from "constructs";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311OperatorProjectionsTopicProps {
  envName: Nyc311Environment;
}

/**
 * Fan-out target for every `Operator` `#METADATA` projection change
 * (`7-data-warehousing.md` §4, Leg 6) —
 * `Nyc311OperatorsStreamFanOutLambda` publishes each `INSERT`/`MODIFY`
 * here, tagged with an `event_name` message attribute. The
 * `operator_snapshots` warehouse Firehose is the only subscriber today.
 */
export class Nyc311OperatorProjectionsTopic extends Construct {
  public readonly topic: sns.Topic;

  constructor(scope: Construct, id: string, props: Nyc311OperatorProjectionsTopicProps) {
    super(scope, id);

    this.topic = new sns.Topic(this, "Topic", {
      topicName: `Nyc311OperatorProjections-${ENV_NAME_SUFFIX[props.envName]}`,
      enforceSSL: true,
    });
  }
}
