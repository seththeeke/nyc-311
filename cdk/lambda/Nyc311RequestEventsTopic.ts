import * as sns from "aws-cdk-lib/aws-sns";
import { Construct } from "constructs";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311RequestEventsTopicProps {
  envName: Nyc311Environment;
}

/**
 * Fan-out target for every real `Request` row change (`7-data-warehousing.md`
 * §4) — `Nyc311RequestsFanOutLambda` publishes each `INSERT`/`MODIFY` here,
 * tagged with an `event_name` message attribute. The order-ingestion queue
 * subscribes with a filter policy (`{event_name: ["INSERT"]}`) — its
 * unchanged "new Requests only" behavior; the `requests` warehouse Firehose
 * (Leg 2) subscribes unfiltered for the full status-transition history.
 */
export class Nyc311RequestEventsTopic extends Construct {
  public readonly topic: sns.Topic;

  constructor(scope: Construct, id: string, props: Nyc311RequestEventsTopicProps) {
    super(scope, id);

    this.topic = new sns.Topic(this, "Topic", {
      topicName: `Nyc311RequestEvents-${ENV_NAME_SUFFIX[props.envName]}`,
      enforceSSL: true,
    });
  }
}
