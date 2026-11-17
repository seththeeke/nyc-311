import * as path from "node:path";
import { App, Lazy, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { beforeAll, describe, expect, it } from "vitest";
import { RequestsTable } from "../../data/RequestsTable";
import { Nyc311MonitoringApiLambda } from "../../lambda/Nyc311MonitoringApiLambda";

const MONITORED = { publicApiId: "pub123" };

const BACKEND_ROOT = path.join(__dirname, "..", "..", "..", "backend");

/* A bare NodejsFunction alongside the bundle, to prove the list is found from the stack rather than passed in. */
function addFunction(stack: Stack, id: string, functionName: string | undefined): void {
  new NodejsFunction(stack, id, {
    functionName,
    entry: path.join(BACKEND_ROOT, "controller", "web-api", "monitoring", "monitoringApiRouter.ts"),
    handler: "monitoringApiRouter",
    runtime: Runtime.NODEJS_22_X,
    projectRoot: BACKEND_ROOT,
    depsLockFilePath: path.join(BACKEND_ROOT, "package-lock.json"),
  });
}

function monitoredLambdasOf(template: Template, functionName: string): string[] {
  const fn = Object.values(template.findResources("AWS::Lambda::Function", { Properties: { FunctionName: functionName } }))[0];
  return JSON.parse((fn.Properties as { Environment: { Variables: { MONITORED_LAMBDAS: string } } }).Environment.Variables.MONITORED_LAMBDAS) as string[];
}

function synthesize(envName: "TEST" | "PROD"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  new Nyc311MonitoringApiLambda(stack, "Nyc311MonitoringApiLambda", {
    envName,
    ...MONITORED,
    requestsTable: new RequestsTable(stack, "RequestsTable", { envName }),
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

describe("Nyc311MonitoringApiLambda", () => {
  let testTemplate: Template;

  beforeAll(() => {
    testTemplate = synthesize("TEST");
  });

  it("bundles the monitoringApiRouter on Node 22", () => {
    testTemplate.hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "Nyc311MonitoringApi-Test",
      Handler: "index.monitoringApiRouter",
      Runtime: "nodejs22.x",
      Timeout: 25,
      MemorySize: 256,
    });
  });

  it("suffixes the function and log group by environment, and destroys the log group with the stack", () => {
    testTemplate.hasResource("AWS::Logs::LogGroup", {
      Properties: { LogGroupName: "/aws/lambda/Nyc311MonitoringApi-Test", RetentionInDays: 30 },
      DeletionPolicy: "Delete",
    });
    synthesize("PROD").hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311MonitoringApi-Prod" });
  });

  it("carries the Requests table name, the one MONITORED_LAMBDAS list, the public API id and the reports bucket", () => {
    expect(envKeysOf(testTemplate)).toEqual(["AGENT_REPORTS_BUCKET", "MONITORED_LAMBDAS", "PUBLIC_API_ID", "REQUESTS_TABLE_NAME"]);
  });

  it("lists itself by literal name plus the pipeline's status Lambda when alone in its stack", () => {
    expect(monitoredLambdasOf(testTemplate, "Nyc311MonitoringApi-Test")).toEqual(["Nyc311MonitoringApi-Test", "Nyc311PipelineStatus"]);
  });

  it("finds every NodejsFunction in the stack, including one built after it (#217)", () => {
    const app = new App();
    const stack = new Stack(app, "FindAllStack", { env: { region: "us-east-1" } });
    addFunction(stack, "Before", "Nyc311Before-Test");
    new Nyc311MonitoringApiLambda(stack, "Nyc311MonitoringApiLambda", { envName: "TEST", ...MONITORED, requestsTable: new RequestsTable(stack, "RequestsTable", { envName: "TEST" }) });
    addFunction(stack, "After", "Nyc311After-Test");

    expect(monitoredLambdasOf(Template.fromStack(stack), "Nyc311MonitoringApi-Test")).toEqual([
      "Nyc311Before-Test",
      "Nyc311MonitoringApi-Test",
      "Nyc311After-Test",
      "Nyc311PipelineStatus",
    ]);
  });

  it.each([
    ["no functionName", undefined],
    ["an unresolved functionName", Lazy.string({ produce: () => "Nyc311Late-Test" })],
  ])("fails synth for a NodejsFunction with %s, which the tile could not name", (_label, functionName) => {
    const app = new App();
    const stack = new Stack(app, "UnnamedStack", { env: { region: "us-east-1" } });
    new Nyc311MonitoringApiLambda(stack, "Nyc311MonitoringApiLambda", { envName: "TEST", ...MONITORED, requestsTable: new RequestsTable(stack, "RequestsTable", { envName: "TEST" }) });
    addFunction(stack, "Unnamed", functionName);

    expect(() => Template.fromStack(stack)).toThrow("UnnamedStack/Unnamed needs a literal, env-suffixed functionName to be on the Lambda health tile");
  });

  it("grants Requests Query/GetItem, CloudWatch metric reads (GetMetricData for the public API's health) and reads of Sable's reports", () => {
    expect(actionsOf(testTemplate)).toEqual(["cloudwatch:GetMetricData", "cloudwatch:GetMetricStatistics", "dynamodb:GetItem", "dynamodb:Query", "s3:GetObject", "s3:ListBucket"]);
  });

  it("reads only Sable's prefix of the account's agent reports bucket, by name (docs/17 §19.6)", () => {
    const app = new App();
    const stack = new Stack(app, "AccountStack", { env: { account: "123456789012", region: "us-east-1" } });
    new Nyc311MonitoringApiLambda(stack, "Nyc311MonitoringApiLambda", { envName: "PROD", ...MONITORED, requestsTable: new RequestsTable(stack, "RequestsTable", { envName: "PROD" }) });
    const template = Template.fromStack(stack);
    const [fn] = Object.values(template.findResources("AWS::Lambda::Function"));
    expect((fn.Properties as { Environment: { Variables: Record<string, unknown> } }).Environment.Variables.AGENT_REPORTS_BUCKET).toBe("nyc311-agent-reports-123456789012");
    const s3 = statementsOf(template).filter((s) => String(s.Action).startsWith("s3:"));
    expect(s3).toEqual([
      expect.objectContaining({ Action: "s3:ListBucket", Resource: "arn:aws:s3:::nyc311-agent-reports-123456789012", Condition: { StringLike: { "s3:prefix": ["software-analyzer-agent/*"] } } }),
      expect.objectContaining({ Action: "s3:GetObject", Resource: "arn:aws:s3:::nyc311-agent-reports-123456789012/software-analyzer-agent/*" }),
    ]);
  });
});
