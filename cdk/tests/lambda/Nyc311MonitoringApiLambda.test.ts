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
  warehouseJobRunnerFunctionName: "Nyc311WarehouseJobRunner-Test",
  adminApiFunctionName: "Nyc311AdminApi-Test",
  featureFlagsApiFunctionName: "Nyc311FeatureFlagsApi-Test",
  dataApiFunctionName: "Nyc311DataApi-Test",
  fleetApiFunctionName: "Nyc311GetFleetLocationsApi-Test",
  webhookSubscriptionsApiFunctionName: "Nyc311RegisterWebhookSubscriptionApi-Test",
  publicV1ApiFunctionName: "Nyc311PublicV1Api-Test",
  publicApiId: "pub123",
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
    expect(keys.filter((key) => key.startsWith("MONITORED_LAMBDA_"))).toHaveLength(17);
    expect(keys).toContain("PUBLIC_API_ID");
    expect(keys).toHaveLength(19);
  });

  it("names itself as the monitored MonitoringApi Lambda, and every other web API bundle by its function name", () => {
    const [fn] = Object.values(testTemplate.findResources("AWS::Lambda::Function"));
    const variables = (fn.Properties as { Environment: { Variables: Record<string, unknown> } }).Environment.Variables;

    expect(variables).toMatchObject({
      MONITORED_LAMBDA_MONITORING_API: "Nyc311MonitoringApi-Test",
      MONITORED_LAMBDA_ADMIN_API: "Nyc311AdminApi-Test",
      MONITORED_LAMBDA_FEATURE_FLAGS_API: "Nyc311FeatureFlagsApi-Test",
      MONITORED_LAMBDA_DATA_API: "Nyc311DataApi-Test",
      MONITORED_LAMBDA_FLEET_API: "Nyc311GetFleetLocationsApi-Test",
      MONITORED_LAMBDA_WEBHOOK_SUBSCRIPTIONS_API: "Nyc311RegisterWebhookSubscriptionApi-Test",
      MONITORED_LAMBDA_PUBLIC_V1_API: "Nyc311PublicV1Api-Test",
      PUBLIC_API_ID: "pub123",
    });
    expect(Object.keys(variables).filter((key) => /METRICS_API|SCHEMA_API|JOBS_API|JOB_RESULT_API|FLEET_LOCATIONS_API/.test(key))).toEqual([]);
  });

  it("grants Requests Query/GetItem and CloudWatch metric reads (GetMetricData for the public API's health)", () => {
    expect(actionsOf(testTemplate)).toEqual(["cloudwatch:GetMetricData", "cloudwatch:GetMetricStatistics", "dynamodb:GetItem", "dynamodb:Query"]);
  });
});
