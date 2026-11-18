import { RemovalPolicy } from "aws-cdk-lib";
import { AttributeType, TableV2 } from "aws-cdk-lib/aws-dynamodb";
import type { Grant, IGrantable } from "aws-cdk-lib/aws-iam";
import type { Construct } from "constructs";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface FeatureFlagsTableProps {
  envName: Nyc311Environment;
}

/**
 * Backs `FeatureFlag` (`11-street-condition-implementation.md` §4) —
 * `flag_key` as the sole key, no GSIs (the admin list is a Scan over a
 * handful of rows), no stream (nothing consumes flag change capture).
 */
export class FeatureFlagsTable extends TableV2 {
  constructor(scope: Construct, id: string, props: FeatureFlagsTableProps) {
    super(scope, id, {
      tableName: `FeatureFlags-${ENV_NAME_SUFFIX[props.envName]}`,
      partitionKey: { name: "flag_key", type: AttributeType.STRING },
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: props.envName === "PROD" }, /* #242; PITR storage bills by table size, Test's is disposable */
      deletionProtection: props.envName === "PROD", /* v1-prod-deployment.md B9; Test stays deletable */
      removalPolicy: RemovalPolicy.RETAIN,
    });
  }

  /**
   * The backend flag read's grant (#202): `dynamodb:GetItem` on this table
   * only, all `featureFlagService.getTreatment` needs. Each calling Lambda
   * calls this instead of the API Lambdas' broader inline grant.
   */
  grantFlagRead(grantee: IGrantable): Grant {
    return this.grant(grantee, "dynamodb:GetItem");
  }
}
