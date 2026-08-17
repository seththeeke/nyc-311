import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, it } from "vitest";
import { Nyc311PipelineStatusLambda } from "../../pipeline/Nyc311PipelineStatusLambda";

const PIPELINE_ARN = "arn:aws:codepipeline:us-east-1:178280182163:Nyc311Pipeline";

function synthesize(): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  new Nyc311PipelineStatusLambda(stack, "Nyc311PipelineStatusLambda", {
    pipelineName: "Nyc311Pipeline",
    pipelineArn: PIPELINE_ARN,
  });
  return Template.fromStack(stack);
}

describe("Nyc311PipelineStatusLambda", () => {
  it("bundles backend/controller/web-api/getPipelineStatusController's exported handler on Node 22", () => {
    const template = synthesize();

    template.hasResourceProperties("AWS::Lambda::Function", {
      Handler: "index.getPipelineStatusController",
      Runtime: "nodejs22.x",
    });
  });

  it("uses a fixed, unsuffixed physical name — there is only ever one Nyc311PipelineStack", () => {
    const template = synthesize();

    template.hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311PipelineStatus" });
    template.hasResourceProperties("AWS::Logs::LogGroup", { LogGroupName: "/aws/lambda/Nyc311PipelineStatus" });
  });

  it("passes the pipeline name as PIPELINE_NAME", () => {
    const template = synthesize();

    template.hasResourceProperties("AWS::Lambda::Function", {
      Environment: { Variables: { PIPELINE_NAME: "Nyc311Pipeline" } },
    });
  });

  it("grants only the three read CodePipeline actions, scoped to this pipeline's own ARN — least privilege", () => {
    const template = synthesize();

    template.hasResourceProperties("AWS::IAM::Policy", {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: [
              "codepipeline:GetPipelineState",
              "codepipeline:ListPipelineExecutions",
              "codepipeline:GetPipelineExecution",
            ],
            Effect: "Allow",
            Resource: PIPELINE_ARN,
          }),
        ]),
      }),
    });
  });
});
