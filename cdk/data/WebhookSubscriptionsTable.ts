import { RemovalPolicy } from "aws-cdk-lib";
import { AttributeType, TableV2 } from "aws-cdk-lib/aws-dynamodb";
import type { Construct } from "constructs";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface WebhookSubscriptionsTableProps {
  envName: Nyc311Environment;
}

/**
 * Backs `WebhookSubscription` (`13-customer-simulation.md` §2) —
 * `subscription_id` as the sole key, no GSIs (the dispatcher's lookup is
 * a Scan bounded by the 25-subscription cap), no stream.
 */
export class WebhookSubscriptionsTable extends TableV2 {
  constructor(scope: Construct, id: string, props: WebhookSubscriptionsTableProps) {
    super(scope, id, {
      tableName: `WebhookSubscriptions-${ENV_NAME_SUFFIX[props.envName]}`,
      partitionKey: { name: "subscription_id", type: AttributeType.STRING },
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      deletionProtection: props.envName === "PROD", /* v1-prod-deployment.md B9; Test stays deletable */
      removalPolicy: RemovalPolicy.RETAIN,
    });
  }
}
