import * as sns from "aws-cdk-lib/aws-sns";
import { Construct } from "constructs";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311PublicApiCallsTopicProps {
  envName: Nyc311Environment;
}

/**
 * One message per public API call (`16-resident-action-models.md` §4),
 * published best-effort by the public API's router. Its one subscriber is
 * the `public_api_calls` warehouse Firehose.
 */
export class Nyc311PublicApiCallsTopic extends Construct {
  public readonly topic: sns.Topic;

  constructor(scope: Construct, id: string, props: Nyc311PublicApiCallsTopicProps) {
    super(scope, id);

    this.topic = new sns.Topic(this, "Topic", {
      topicName: `Nyc311PublicApiCalls-${ENV_NAME_SUFFIX[props.envName]}`,
      enforceSSL: true,
    });
  }
}
