import * as sns from "aws-cdk-lib/aws-sns";
import { Construct } from "constructs";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311OrderProjectionsTopicProps {
  envName: Nyc311Environment;
}

/**
 * Fan-out target for every change to the `Order` `#METADATA` projection
 * row (`7-data-warehousing.md` §4) — `Nyc311OrdersStreamFanOutLambda`
 * publishes each `INSERT`/`MODIFY` of that row here, tagged with an
 * `event_name` message attribute. Only the warehouse consumes it (the
 * `order_snapshots` Firehose, added in Leg 2); the operational
 * Order-evaluation pipeline stays on `Nyc311OrderEventsTopic`.
 */
export class Nyc311OrderProjectionsTopic extends Construct {
  public readonly topic: sns.Topic;

  constructor(scope: Construct, id: string, props: Nyc311OrderProjectionsTopicProps) {
    super(scope, id);

    this.topic = new sns.Topic(this, "Topic", {
      topicName: `Nyc311OrderProjections-${ENV_NAME_SUFFIX[props.envName]}`,
      enforceSSL: true,
    });
  }
}
