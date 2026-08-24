import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { Nyc311PipelineStack } from "../../pipeline/Nyc311PipelineStack";

const TEST_ENV = { account: "178280182163", region: "us-east-1" };

function synthesize(): Template {
  const app = new App();
  const stack = new Nyc311PipelineStack(app, "TestPipelineStack", {
    env: TEST_ENV,
  });
  return Template.fromStack(stack);
}

describe("Nyc311PipelineStack", () => {
  it("creates a V2, self-mutating CodePipeline sourced from the externally-authorized GitHub connection", () => {
    const template = synthesize();

    template.hasResourceProperties("AWS::CodePipeline::Pipeline", {
      Name: "Nyc311Pipeline",
      PipelineType: "V2",
    });
    template.hasResourceProperties("AWS::CodePipeline::Pipeline", {
      Stages: Match.arrayWith([
        Match.objectLike({
          Name: "Source",
          Actions: Match.arrayWith([
            Match.objectLike({
              Configuration: Match.objectLike({
                ConnectionArn:
                  "arn:aws:codeconnections:us-east-1:178280182163:connection/48eddf51-8724-497c-8ff1-c4507a78e793",
                FullRepositoryId: "seththeeke/nyc-311",
                BranchName: "main",
              }),
            }),
          ]),
        }),
      ]),
    });
    template.hasResourceProperties("AWS::CodePipeline::Pipeline", {
      Stages: Match.arrayWith([
        Match.objectLike({
          Name: "UpdatePipeline",
          Actions: Match.arrayWith([Match.objectLike({ Name: "SelfMutate" })]),
        }),
      ]),
    });
  });

  it("synths and diffs against bin/pipeline.ts explicitly, not cdk.json's default app", () => {
    /*
     * Regression test: cdk.json's default app (bin/app.ts) only defines
     * the bare Nyc311-Test/Nyc311-Prod stacks, not Nyc311PipelineStack or
     * the Stage-wrapped structure self-mutation and the deploy actions
     * need — omitting --app here previously produced a cloud assembly
     * self-mutation couldn't find its own stack in.
     */
    const template = synthesize();

    template.hasResourceProperties("AWS::CodeBuild::Project", {
      Source: Match.objectLike({
        BuildSpec: Match.stringLikeRegexp(
          'cdk synth --app \\\\"npx ts-node --prefer-ts-exts bin/pipeline\\.ts\\\\"',
        ),
      }),
    });
    template.hasResourceProperties("AWS::CodeBuild::Project", {
      Source: Match.objectLike({
        BuildSpec: Match.stringLikeRegexp(
          'cdk diff Nyc311-Prod --app \\\\"npx ts-node --prefer-ts-exts bin/pipeline\\.ts\\\\"',
        ),
      }),
    });
  });

  it("deploys Nyc311-Test and Nyc311-Prod as pipeline stages, with a non-blocking diff before Prod, a coverage publish, and integration tests after", () => {
    const template = synthesize();

    /*
     * The coverage-publish and integration-test post steps run in
     * parallel (same RunOrder), and CDK Pipelines doesn't render them in
     * the array order they were passed to `post` — asserted independently
     * below rather than as one ordered arrayWith (which requires its
     * patterns to match as an in-order subsequence), so this doesn't
     * become order-dependent.
     */
    template.hasResourceProperties("AWS::CodePipeline::Pipeline", {
      Stages: Match.arrayWith([
        Match.objectLike({
          Name: "DeployTest",
          Actions: Match.arrayWith([Match.objectLike({ Name: "PublishCoverageTest" })]),
        }),
      ]),
    });
    template.hasResourceProperties("AWS::CodePipeline::Pipeline", {
      Stages: Match.arrayWith([
        Match.objectLike({
          Name: "DeployTest",
          Actions: Match.arrayWith([Match.objectLike({ Name: "IntegrationTestsTest" })]),
        }),
      ]),
    });
    template.hasResourceProperties("AWS::CodePipeline::Pipeline", {
      Stages: Match.arrayWith([
        Match.objectLike({
          Name: "DeployProd",
          Actions: Match.arrayWith([Match.objectLike({ Name: "ProdDiff" })]),
        }),
      ]),
    });
    template.hasResourceProperties("AWS::CodePipeline::Pipeline", {
      Stages: Match.arrayWith([
        Match.objectLike({
          Name: "DeployProd",
          Actions: Match.arrayWith([Match.objectLike({ Name: "PublishCoverageProd" })]),
        }),
      ]),
    });
    template.hasResourceProperties("AWS::CodePipeline::Pipeline", {
      Stages: Match.arrayWith([
        Match.objectLike({
          Name: "DeployProd",
          Actions: Match.arrayWith([Match.objectLike({ Name: "IntegrationTestsProd" })]),
        }),
      ]),
    });
  });

  it("wires a pipeline-failure-only notification rule to an email-subscribed SNS topic", () => {
    const template = synthesize();

    template.hasResourceProperties("AWS::SNS::Subscription", {
      Protocol: "email",
      Endpoint: "seththeeke@gmail.com",
    });
    template.hasResourceProperties("AWS::CodeStarNotifications::NotificationRule", {
      DetailType: "FULL",
      EventTypeIds: ["codepipeline-pipeline-pipeline-execution-failed"],
    });
  });

  it("denies the nyc311 CLI user sts:AssumeRole on the CDK deploy and cfn-exec roles", () => {
    const template = synthesize();

    template.hasResourceProperties("AWS::IAM::Policy", {
      PolicyName: "Nyc311DenyDirectDeploy",
      Users: ["seththeeke-cli"],
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Sid: "DenyAssumeCdkDeployRoles",
            Effect: "Deny",
            Action: "sts:AssumeRole",
            Resource: [
              "arn:aws:iam::178280182163:role/cdk-hnb659fds-deploy-role-178280182163-us-east-1",
              "arn:aws:iam::178280182163:role/cdk-hnb659fds-cfn-exec-role-178280182163-us-east-1",
            ],
          }),
        ]),
      }),
    });
  });

  it("also denies the nyc311 CLI user direct CloudFormation mutation on Nyc311-Test/Nyc311-Prod only, closing the AdministratorAccess fallback", () => {
    const template = synthesize();

    template.hasResourceProperties("AWS::IAM::Policy", {
      PolicyName: "Nyc311DenyDirectDeploy",
      Users: ["seththeeke-cli"],
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Sid: "DenyDirectCloudFormationMutation",
            Effect: "Deny",
            Action: [
              "cloudformation:CreateStack",
              "cloudformation:UpdateStack",
              "cloudformation:DeleteStack",
              "cloudformation:CreateChangeSet",
              "cloudformation:ExecuteChangeSet",
              "cloudformation:DeleteChangeSet",
            ],
            Resource: [
              "arn:aws:cloudformation:us-east-1:178280182163:stack/Nyc311-Test/*",
              "arn:aws:cloudformation:us-east-1:178280182163:stack/Nyc311-Prod/*",
            ],
          }),
        ]),
      }),
    });
  });

  it("wires the pipeline-status API/Lambda, scoped to this pipeline's own ARN", () => {
    const template = synthesize();

    template.hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311PipelineStatus" });
    template.hasResourceProperties("AWS::ApiGatewayV2::Api", { Name: "Nyc311PipelineStatusApi" });
    template.hasResourceProperties("AWS::ApiGatewayV2::Route", { RouteKey: "GET /pipeline/status" });
    template.hasOutput("Nyc311PipelineStatusApiUrl", {});
  });

  it("does not restrict direct deploys of the pipeline stack itself, the recovery path for a broken Synth step", () => {
    const template = synthesize();

    const [{ Properties }] = Object.values(
      template.findResources("AWS::IAM::Policy", {
        Properties: { PolicyName: "Nyc311DenyDirectDeploy" },
      }),
    ) as { Properties: { PolicyDocument: { Statement: { Sid: string; Resource: string[] }[] } } }[];

    const cfnStatement = Properties.PolicyDocument.Statement.find(
      (s) => s.Sid === "DenyDirectCloudFormationMutation",
    );
    const coversPipelineStack = cfnStatement?.Resource.some((r) =>
      r.includes("TestPipelineStack"),
    );

    expect(coversPipelineStack).toBe(false);
  });
});
