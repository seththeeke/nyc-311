import * as sns from "aws-cdk-lib/aws-sns";
import { Construct } from "constructs";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311DispatchDecisionsTopicProps {
  envName: Nyc311Environment;
}

/**
 * One message per dispatch decision (`20-ml-driver-assignment.md` §2.4),
 * published best-effort by the order-scheduling Lambda. Its one subscriber is
 * the `dispatch_decisions` warehouse Firehose.
 */
export class Nyc311DispatchDecisionsTopic extends Construct {
  public readonly topic: sns.Topic;

  constructor(scope: Construct, id: string, props: Nyc311DispatchDecisionsTopicProps) {
    super(scope, id);

    this.topic = new sns.Topic(this, "Topic", {
      topicName: `Nyc311DispatchDecisions-${ENV_NAME_SUFFIX[props.envName]}`,
      enforceSSL: true,
    });
  }
}
