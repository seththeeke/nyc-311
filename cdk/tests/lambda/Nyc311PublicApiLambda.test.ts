import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { beforeAll, describe, expect, it } from "vitest";
import { Nyc311PublicApiLambda, PUBLIC_API_BUNDLING_HOOKS } from "../../lambda/Nyc311PublicApiLambda";

function synthesize(envName: "TEST" | "PROD"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  new Nyc311PublicApiLambda(stack, "Nyc311PublicApiLambda", { envName });
  return Template.fromStack(stack);
}

describe("Nyc311PublicApiLambda", () => {
  let testTemplate: Template;

  beforeAll(() => {
    testTemplate = synthesize("TEST");
  });

  it("bundles the publicV1ApiRouter on Node 22", () => {
    testTemplate.hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "Nyc311PublicV1Api-Test",
      Handler: "index.publicV1ApiRouter",
      Runtime: "nodejs22.x",
      Timeout: 10,
      MemorySize: 512,
    });
  });

  it("suffixes the function and log group by environment, and destroys the log group with the stack", () => {
    testTemplate.hasResource("AWS::Logs::LogGroup", {
      Properties: { LogGroupName: "/aws/lambda/Nyc311PublicV1Api-Test", RetentionInDays: 30 },
      DeletionPolicy: "Delete",
    });
    synthesize("PROD").hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311PublicV1Api-Prod" });
  });

  it("has no table grants until an operation needs one", () => {
    expect(Object.keys(testTemplate.findResources("AWS::IAM::Policy"))).toEqual([]);
  });

  it("copies the OpenAPI spec beside the bundled handler, and does nothing else", () => {
    expect(PUBLIC_API_BUNDLING_HOOKS.beforeBundling("/in", "/out")).toEqual([]);
    expect(PUBLIC_API_BUNDLING_HOOKS.beforeInstall("/in", "/out")).toEqual([]);
    expect(PUBLIC_API_BUNDLING_HOOKS.afterBundling("/in", "/out")).toEqual([
      'cp "/in/controller/web-api/publicV1/openapi.yaml" "/out/openapi.yaml"',
    ]);
  });
});
