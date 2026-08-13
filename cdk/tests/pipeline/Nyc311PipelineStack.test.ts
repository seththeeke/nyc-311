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

  it("deploys Nyc311-Test and Nyc311-Prod as pipeline stages, with a non-blocking diff before Prod", () => {
    const template = synthesize();

    template.hasResourceProperties("AWS::CodePipeline::Pipeline", {
      Stages: Match.arrayWith([
        Match.objectLike({ Name: "DeployTest" }),
        Match.objectLike({
          Name: "DeployProd",
          Actions: Match.arrayWith([Match.objectLike({ Name: "ProdDiff" })]),
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
