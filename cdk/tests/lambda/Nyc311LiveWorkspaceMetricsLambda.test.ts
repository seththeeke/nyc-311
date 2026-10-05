import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { LiveWorkspaceMetricsTable } from "../../data/LiveWorkspaceMetricsTable";
import { OperatorsTable } from "../../data/OperatorsTable";
import { OrdersTable } from "../../data/OrdersTable";
import { Nyc311OrderEventsTopic } from "../../lambda/Nyc311OrderEventsTopic";
import { Nyc311LiveWorkspaceMetricsQueue } from "../../lambda/Nyc311LiveWorkspaceMetricsQueue";
import { Nyc311LiveWorkspaceMetricsLambda } from "../../lambda/Nyc311LiveWorkspaceMetricsLambda";

function synthesize(envName: "TEST" | "PROD"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  const ordersTable = new OrdersTable(stack, "OrdersTable", { envName });
  const operatorsTable = new OperatorsTable(stack, "OperatorsTable", { envName });
  const liveWorkspaceMetricsTable = new LiveWorkspaceMetricsTable(stack, "LiveWorkspaceMetricsTable", { envName });
  const orderEventsTopic = new Nyc311OrderEventsTopic(stack, "Nyc311OrderEventsTopic", { envName });
  const liveWorkspaceMetricsQueue = new Nyc311LiveWorkspaceMetricsQueue(stack, "Nyc311LiveWorkspaceMetricsQueue", {
    envName,
    orderEventsTopic,
  });
  new Nyc311LiveWorkspaceMetricsLambda(stack, "Nyc311LiveWorkspaceMetricsLambda", {
    envName,
    ordersTable,
    operatorsTable,
    liveWorkspaceMetricsTable,
    liveWorkspaceMetricsQueue,
  });
  return Template.fromStack(stack);
}

interface Statement {
  Action: string | string[];
  Resource: unknown;
}

function statements(template: Template): Statement[] {
  return Object.values(template.findResources("AWS::IAM::Policy")).flatMap(
    (policy) => (policy.Properties as { PolicyDocument: { Statement: Statement[] } }).PolicyDocument.Statement
  );
}

function dynamoActionsOn(template: Template, tableLogicalIdPrefix: string): string[] {
  return statements(template)
    .filter((statement) => JSON.stringify(statement.Resource).includes(`"${tableLogicalIdPrefix}`))
    .flatMap((statement) => (Array.isArray(statement.Action) ? statement.Action : [statement.Action]))
    .filter((action) => action.startsWith("dynamodb:"))
    .sort();
}

describe("Nyc311LiveWorkspaceMetricsLambda", () => {
  it("bundles backend/controller/analytics/recordWorkspaceMetricsController's exported handler on Node 22", () => {
    synthesize("TEST").hasResourceProperties("AWS::Lambda::Function", {
      Handler: "index.recordWorkspaceMetricsController",
      Runtime: "nodejs22.x",
      Timeout: 30,
    });
  });

  it("suffixes the function name and log group by environment, distinguishing Test from Prod", () => {
    const test = synthesize("TEST");
    test.hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311LiveWorkspaceMetrics-Test" });
    test.hasResourceProperties("AWS::Logs::LogGroup", {
      LogGroupName: "/aws/lambda/Nyc311LiveWorkspaceMetrics-Test",
      RetentionInDays: 30,
    });
    test.hasResource("AWS::Logs::LogGroup", { DeletionPolicy: "Delete" });

    synthesize("PROD").hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311LiveWorkspaceMetrics-Prod" });
  });

  it("passes the Orders, Operators, and LiveWorkspaceMetrics table names as env", () => {
    synthesize("TEST").hasResourceProperties("AWS::Lambda::Function", {
      Environment: {
        Variables: {
          ORDERS_TABLE_NAME: { Ref: Match.stringLikeRegexp("^OrdersTable") },
          OPERATORS_TABLE_NAME: { Ref: Match.stringLikeRegexp("^OperatorsTable") },
          LIVE_WORKSPACE_METRICS_TABLE_NAME: { Ref: Match.stringLikeRegexp("^LiveWorkspaceMetricsTable") },
        },
      },
    });
  });

  it("wires an SQS event source mapping on its queue, batch 10, per-item failure reporting", () => {
    synthesize("TEST").hasResourceProperties("AWS::Lambda::EventSourceMapping", {
      BatchSize: 10,
      FunctionResponseTypes: ["ReportBatchItemFailures"],
      EventSourceArn: { "Fn::GetAtt": [Match.stringLikeRegexp("^Nyc311LiveWorkspaceMetricsQueue"), "Arn"] },
    });
  });

  it("grants exactly Query on Orders, GetItem on Operators, and Put/Update on its own table", () => {
    const template = synthesize("TEST");

    expect(dynamoActionsOn(template, "OrdersTable")).toEqual(["dynamodb:Query"]);
    expect(dynamoActionsOn(template, "OperatorsTable")).toEqual(["dynamodb:GetItem"]);
    expect(dynamoActionsOn(template, "LiveWorkspaceMetricsTable")).toEqual(["dynamodb:PutItem", "dynamodb:UpdateItem"]);
  });
});
