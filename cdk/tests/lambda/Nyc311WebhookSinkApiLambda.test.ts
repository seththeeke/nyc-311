import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { beforeAll, describe, expect, it } from "vitest";
import { WebhookSinkDeliveriesTable } from "../../data/WebhookSinkDeliveriesTable";
import { Nyc311WebhookSinkApiLambda } from "../../lambda/Nyc311WebhookSinkApiLambda";

function synthesize(envName: "TEST" | "PROD"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  new Nyc311WebhookSinkApiLambda(stack, "Nyc311WebhookSinkApiLambda", {
    envName,
    webhookSinkDeliveriesTable: new WebhookSinkDeliveriesTable(stack, "WebhookSinkDeliveriesTable", { envName }),
  });
  return Template.fromStack(stack);
}

type Statement = { Action?: string | string[]; Resource?: unknown };

function statementsOf(template: Template): Statement[] {
  return Object.values(template.findResources("AWS::IAM::Policy")).flatMap(
    (policy) => (policy.Properties as { PolicyDocument: { Statement: Statement[] } }).PolicyDocument.Statement
  );
}

function actionsOf(template: Template): string[] {
  return [...new Set(statementsOf(template).flatMap((s) => (Array.isArray(s.Action) ? s.Action : s.Action ? [s.Action] : [])))].sort();
}

function envKeysOf(template: Template): string[] {
  const [fn] = Object.values(template.findResources("AWS::Lambda::Function"));
  return Object.keys((fn.Properties as { Environment: { Variables: Record<string, unknown> } }).Environment.Variables).sort();
}

describe("Nyc311WebhookSinkApiLambda", () => {
  let testTemplate: Template;

  beforeAll(() => {
    testTemplate = synthesize("TEST");
  });

  it("bundles the webhookSinkApiRouter on Node 22", () => {
    testTemplate.hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "Nyc311WebhookSinkApi-Test",
      Handler: "index.webhookSinkApiRouter",
      Runtime: "nodejs22.x",
      Timeout: 10,
      MemorySize: 512,
    });
  });

  it("suffixes the function and log group by environment, and destroys the log group with the stack", () => {
    testTemplate.hasResource("AWS::Logs::LogGroup", {
      Properties: { LogGroupName: "/aws/lambda/Nyc311WebhookSinkApi-Test", RetentionInDays: 30 },
      DeletionPolicy: "Delete",
    });
    synthesize("PROD").hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311WebhookSinkApi-Prod" });
  });

  it("carries the deliveries table and the sink secret's parameter name", () => {
    expect(envKeysOf(testTemplate)).toEqual(["WEBHOOK_SINK_DELIVERIES_TABLE_NAME", "WEBHOOK_SINK_SECRET_PARAMETER_NAME"]);
  });

  it("grants the two old roles' union: PutItem and Scan on the deliveries table, and reads the sink secret", () => {
    expect(actionsOf(testTemplate)).toEqual(["dynamodb:PutItem", "dynamodb:Scan", "ssm:GetParameter"]);
  });

  it("scopes ssm:GetParameter to the one sink secret parameter", () => {
    const [ssm] = statementsOf(testTemplate).filter((s) => s.Action === "ssm:GetParameter");
    expect(JSON.stringify(ssm.Resource)).toMatch(/parameter\//);
    expect(JSON.stringify(ssm.Resource)).not.toMatch(/\*/);
  });
});
