import { CustomResource, RemovalPolicy } from "aws-cdk-lib";
import * as logs from "aws-cdk-lib/aws-logs";
import * as cr from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";
import { CUSTOMER_ENV_SUFFIX } from "./customerConfig";
import type { CustomerResidentSyncLambda } from "./CustomerResidentSyncLambda";
import { residentSyncHash } from "./residentSeedFiles";

export interface CustomerResidentSyncProps {
  syncLambda: CustomerResidentSyncLambda;
  /** Defaults to the hash of the seeds and the sync's own code; tests pass a fixed one. */
  seedHash?: string;
}

/**
 * Runs the seed sync on deploy (§2 customer side, decision 2). The
 * `SeedHash` property changes whenever a seed, the prompt or the sync's
 * code changes, which is what makes CloudFormation send an Update; an
 * unchanged deploy does not invoke it. A failed sync fails the deploy.
 */
export class CustomerResidentSync extends Construct {
  constructor(scope: Construct, id: string, props: CustomerResidentSyncProps) {
    super(scope, id);
    const providerName = `CustomerResidentSyncProvider-${CUSTOMER_ENV_SUFFIX}`;
    const provider = new cr.Provider(this, "Provider", {
      onEventHandler: props.syncLambda,
      providerFunctionName: providerName,
      logGroup: new logs.LogGroup(this, "ProviderLogGroup", {
        logGroupName: `/aws/lambda/${providerName}`,
        retention: logs.RetentionDays.ONE_MONTH,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
    });
    new CustomResource(this, "Resource", {
      serviceToken: provider.serviceToken,
      resourceType: "Custom::ResidentSeedSync",
      properties: { SeedHash: props.seedHash ?? residentSyncHash() },
    });
  }
}
