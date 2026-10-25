import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { beforeAll, describe, expect, it } from "vitest";
import { LiveWorkspaceMetricsTable } from "../../data/LiveWorkspaceMetricsTable";
import { Nyc311DataApiLambda } from "../../warehouse/Nyc311DataApiLambda";
import { Nyc311WarehouseBucket } from "../../warehouse/Nyc311WarehouseBucket";
import { Nyc311WarehouseCatalog } from "../../warehouse/Nyc311WarehouseCatalog";

function synthesize(envName: "TEST" | "PROD"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  const warehouseBucket = new Nyc311WarehouseBucket(stack, "Nyc311WarehouseBucket", { envName });
  new Nyc311DataApiLambda(stack, "Nyc311DataApiLambda", {
    envName,
    warehouseCatalog: new Nyc311WarehouseCatalog(stack, "Nyc311WarehouseCatalog", { envName, warehouseBucket }),
    liveWorkspaceMetricsTable: new LiveWorkspaceMetricsTable(stack, "LiveWorkspaceMetricsTable", { envName }),
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

describe("Nyc311DataApiLambda", () => {
  let testTemplate: Template;

  beforeAll(() => {
    testTemplate = synthesize("TEST");
  });

  it("bundles the dataApiRouter on Node 22", () => {
    testTemplate.hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "Nyc311DataApi-Test",
      Handler: "index.dataApiRouter",
      Runtime: "nodejs22.x",
      Timeout: 10,
      MemorySize: 256,
    });
  });

  it("suffixes the function and log group by environment, and destroys the log group with the stack", () => {
    testTemplate.hasResource("AWS::Logs::LogGroup", {
      Properties: { LogGroupName: "/aws/lambda/Nyc311DataApi-Test", RetentionInDays: 30 },
      DeletionPolicy: "Delete",
    });
    synthesize("PROD").hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311DataApi-Prod" });
  });

  it("carries the warehouse database and live metrics table names", () => {
    expect(envKeysOf(testTemplate)).toEqual(["LIVE_WORKSPACE_METRICS_TABLE_NAME", "WAREHOUSE_DATABASE_NAME"]);
  });

  it("is read-only: Glue catalog reads plus a BatchGetItem on the live metrics table", () => {
    expect(actionsOf(testTemplate)).toEqual(["dynamodb:BatchGetItem", "glue:GetDatabase", "glue:GetTable", "glue:GetTables"]);
  });

  it("scopes the Glue reads to the catalog, the warehouse database and its tables", () => {
    const glue = statementsOf(testTemplate).filter((s) => Array.isArray(s.Action) && s.Action.includes("glue:GetTable"));
    expect(glue).toHaveLength(1);
    expect(glue[0].Resource).toHaveLength(3);
    expect(JSON.stringify(glue[0].Resource)).toMatch(/:catalog"/);
    expect(JSON.stringify(glue[0].Resource)).not.toMatch(/"\*"/);
  });
});
