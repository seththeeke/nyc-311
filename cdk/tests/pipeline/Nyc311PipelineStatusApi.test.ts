import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { describe, it } from "vitest";
import { Nyc311PipelineStatusLambda } from "../../pipeline/Nyc311PipelineStatusLambda";
import { Nyc311PipelineStatusApi } from "../../pipeline/Nyc311PipelineStatusApi";

function synthesize(): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  const pipelineStatusLambda = new Nyc311PipelineStatusLambda(stack, "Nyc311PipelineStatusLambda", {
    pipelineName: "Nyc311Pipeline",
    pipelineArn: "arn:aws:codepipeline:us-east-1:178280182163:Nyc311Pipeline",
  });
  new Nyc311PipelineStatusApi(stack, "Nyc311PipelineStatusApi", { pipelineStatusLambda });
  return Template.fromStack(stack);
}

describe("Nyc311PipelineStatusApi", () => {
  it("is a second, separate HTTP API from Nyc311Api", () => {
    const template = synthesize();

    template.hasResourceProperties("AWS::ApiGatewayV2::Api", {
      Name: "Nyc311PipelineStatusApi",
      ProtocolType: "HTTP",
    });
    template.resourceCountIs("AWS::ApiGatewayV2::Api", 1);
  });

  it("allows CORS from both the Test and Prod CloudFront domains, plus local dev, GET only", () => {
    const template = synthesize();

    template.hasResourceProperties("AWS::ApiGatewayV2::Api", {
      CorsConfiguration: {
        AllowOrigins: [
          "https://d3u5wagmbm10bm.cloudfront.net",
          "https://d3n0h6hoc7c771.cloudfront.net",
          "http://localhost:5173",
        ],
        AllowMethods: ["GET"],
      },
    });
  });

  it("wires GET /pipeline/status to the pipeline-status Lambda", () => {
    const template = synthesize();

    template.hasResourceProperties("AWS::ApiGatewayV2::Route", { RouteKey: "GET /pipeline/status" });
    template.resourceCountIs("AWS::ApiGatewayV2::Route", 1);
    template.hasResourceProperties("AWS::ApiGatewayV2::Integration", {
      IntegrationType: "AWS_PROXY",
      PayloadFormatVersion: "2.0",
    });
  });
});
