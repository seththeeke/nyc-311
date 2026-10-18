import { Stage, type StageProps } from "aws-cdk-lib";
import type { Construct } from "constructs";
import { Nyc311CustomerStack } from "../customer/Nyc311CustomerStack";
import { CUSTOMER_STACK_NAME } from "../customer/customerConfig";

/**
 * Wraps `Nyc311CustomerStack` as its own CDK Pipelines `Stage`
 * (`13-customer-simulation.md`, decision 2026-10-13) — deployed after
 * `DeployProd`, so BoroughSim's Prod deploy has finished before the
 * customer is touched. The one file outside `cdk/customer/` allowed to
 * import from it (CLAUDE.md §5.3).
 */
export class Nyc311CustomerStage extends Stage {
  constructor(scope: Construct, id: string, props: StageProps) {
    super(scope, id, props);

    new Nyc311CustomerStack(this, "Nyc311CustomerStack", {
      env: props.env,
      stackName: CUSTOMER_STACK_NAME,
    });
  }
}
