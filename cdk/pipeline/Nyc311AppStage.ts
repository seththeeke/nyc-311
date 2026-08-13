import { Stage, StageProps } from "aws-cdk-lib";
import type { Construct } from "constructs";
import { Nyc311Stack, Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311AppStageProps extends StageProps {
  envName: Nyc311Environment;
}

const STACK_NAME_BY_ENV: Record<Nyc311Environment, string> = {
  TEST: "Nyc311-Test",
  PROD: "Nyc311-Prod",
};

/**
 * Wraps `Nyc311Stack` for one environment as a CDK Pipelines `Stage`. The
 * explicit `stackName` below matches the stack names already deployed by
 * hand (`aws-code-pipeline-plan.md` §2), so the pipeline's first deploy is
 * a CloudFormation update to those stacks, not a create.
 */
export class Nyc311AppStage extends Stage {
  constructor(scope: Construct, id: string, props: Nyc311AppStageProps) {
    super(scope, id, props);

    new Nyc311Stack(this, "Nyc311Stack", {
      env: props.env,
      envName: props.envName,
      stackName: STACK_NAME_BY_ENV[props.envName],
    });
  }
}
