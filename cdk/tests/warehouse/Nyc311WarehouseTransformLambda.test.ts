import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { Nyc311WarehouseTransformLambda } from "../../warehouse/Nyc311WarehouseTransformLambda";

function synth(envName: "TEST" | "PROD"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  new Nyc311WarehouseTransformLambda(stack, "Nyc311WarehouseTransformLambda", { envName });
  return Template.fromStack(stack);
}

describe("Nyc311WarehouseTransformLambda", () => {
  it("bundles warehouseRecordTransformController on Node 22, named per environment", () => {
    const t = synth("TEST");
    t.hasResourceProperties("AWS::Lambda::Function", {
      Handler: "index.warehouseRecordTransformController",
      Runtime: "nodejs22.x",
      FunctionName: "Nyc311WarehouseTransform-Test",
    });
    synth("PROD").hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311WarehouseTransform-Prod" });
  });

  it("has no DynamoDB / SNS / S3 access — pure record shaping", () => {
    const t = synth("TEST");
    const policies = t.findResources("AWS::IAM::Policy");
    const allActions = Object.values(policies)
      .flatMap((p) => (p.Properties as { PolicyDocument: { Statement: { Action: unknown }[] } }).PolicyDocument.Statement)
      .flatMap((s) => (Array.isArray(s.Action) ? s.Action : [s.Action]));
    expect(
      allActions.some((a) => typeof a === "string" && /^(dynamodb|sns|s3|firehose|states):/.test(a))
    ).toBe(false);
  });
});
