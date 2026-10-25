import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { beforeAll, describe, expect, it } from "vitest";
import { RequestsTable } from "../../data/RequestsTable";
import { Nyc311MonitoringApiLambda } from "../../lambda/Nyc311MonitoringApiLambda";

const MONITORED = {
  pollerFunctionName: "Nyc311Poller-Test",
  orderFanOutFunctionName: "Nyc311RequestsFanOut-Test",
  locationsFanOutFunctionName: "Nyc311LocationsFanOut-Test",
  operatorsFanOutFunctionName: "Nyc311OperatorsStreamFanOut-Test",
  requestEvaluationFunctionName: "Nyc311RequestEvaluation-Test",
  orderEventFanOutFunctionName: "Nyc311OrdersStreamFanOut-Test",
  orderEvaluationFunctionName: "Nyc311OrderEvaluation-Test",
  orderSchedulingFunctionName: "Nyc311OrderScheduling-Test",
  metricsApiFunctionName: "Nyc311MetricsApi-Test",
  warehouseJobRunnerFunctionName: "Nyc311WarehouseJobRunner-Test",
  warehouseSchemaApiFunctionName: "Nyc311WarehouseSchemaApi-Test",
  warehouseJobsApiFunctionName: "Nyc311WarehouseJobsApi-Test",
  jobResultApiFunctionName: "Nyc311JobResultApi-Test",
  workspaceMetricsApiFunctionName: "Nyc311WorkspaceMetricsApi-Test",
  fleetLocationsApiFunctionName: "Nyc311GetFleetLocationsApi-Test",
};

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

  it("carries the Requests table name plus every MONITORED_LAMBDA_* name the health tile reads", () => {
    const keys = envKeysOf(testTemplate);
    expect(keys).toContain("REQUESTS_TABLE_NAME");
    expect(keys.filter((key) => key.startsWith("MONITORED_LAMBDA_"))).toHaveLength(16);
    expect(keys).toHaveLength(17);
  });

  it("grants exactly the two old roles' union: Requests Query/GetItem and CloudWatch metric reads", () => {
    expect(actionsOf(testTemplate)).toEqual(["cloudwatch:GetMetricStatistics", "dynamodb:GetItem", "dynamodb:Query"]);
  });
});
