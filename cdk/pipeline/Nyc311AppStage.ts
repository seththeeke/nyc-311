import { Stage, StageProps, CfnOutput } from "aws-cdk-lib";
import type { Construct } from "constructs";
import { Nyc311Stack, Nyc311Environment } from "../stack/Nyc311Stack";
import { Nyc311TeamChatStack } from "../teamChat/Nyc311TeamChatStack";

export interface Nyc311AppStageProps extends StageProps {
  envName: Nyc311Environment;
}

const STACK_NAME_BY_ENV: Record<Nyc311Environment, string> = {
  TEST: "Nyc311-Test",
  PROD: "Nyc311-Prod",
};

const TEAM_CHAT_STACK_NAME_BY_ENV: Record<Nyc311Environment, string> = {
  TEST: "Nyc311TeamChat-Test",
  PROD: "Nyc311TeamChat-Prod",
};

/**
 * Wraps `Nyc311Stack` for one environment as a CDK Pipelines `Stage`. The
 * explicit `stackName` below matches the stack names already deployed by
 * hand (`aws-code-pipeline-plan.md` §2), so the pipeline's first deploy is
 * a CloudFormation update to those stacks, not a create.
 */
export class Nyc311AppStage extends Stage {
  /** 4-pipeline-integration-tests.md §5 — passed to the pipeline's integration-test step via envFromCfnOutputs. */
  public readonly apiUrlOutput: CfnOutput;
  /** 9-admin-auth-integration.md §8 — same mechanism, for the integration suite's test-admin sign-in. */
  public readonly adminUserPoolClientIdOutput: CfnOutput;
  /** 16-resident-action-models.md §2 — the public API's URL, for its integration tests. */
  public readonly publicApiUrlOutput: CfnOutput;
  /** docs/17-executive-team.md §14 L4 — the Team Chat API's URL, for its integration tests. */
  public readonly chatApiUrlOutput: CfnOutput;

  constructor(scope: Construct, id: string, props: Nyc311AppStageProps) {
    super(scope, id, props);

    const nyc311Stack = new Nyc311Stack(this, "Nyc311Stack", {
      env: props.env,
      envName: props.envName,
      stackName: STACK_NAME_BY_ENV[props.envName],
    });

    this.apiUrlOutput = nyc311Stack.apiUrlOutput;
    this.adminUserPoolClientIdOutput = nyc311Stack.adminUserPoolClientIdOutput;
    this.publicApiUrlOutput = nyc311Stack.publicApiUrlOutput;

    /* Team Chat (CLAUDE.md §5.3, third standing exception) reads Nyc311Stack's SSM parameters, so it deploys after it. */
    const teamChatStack = new Nyc311TeamChatStack(this, "Nyc311TeamChatStack", {
      env: props.env,
      envName: props.envName,
      stackName: TEAM_CHAT_STACK_NAME_BY_ENV[props.envName],
    });
    teamChatStack.addDependency(nyc311Stack);
    this.chatApiUrlOutput = teamChatStack.chatApiUrlOutput;
  }
}
