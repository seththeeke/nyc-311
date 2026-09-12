import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { OrdersTable } from "../../data/OrdersTable";
import { OperatorsTable } from "../../data/OperatorsTable";
import { Nyc311OrderExecutionLambda } from "../../lambda/Nyc311OrderExecutionLambda";

function synthesize(envName: "TEST" | "PROD", simulationTimeScale = 100): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  const ordersTable = new OrdersTable(stack, "OrdersTable", { envName });
  const operatorsTable = new OperatorsTable(stack, "OperatorsTable", { envName });
  new Nyc311OrderExecutionLambda(stack, "Nyc311OrderExecutionLambda", {
    envName,
    ordersTable,
    operatorsTable,
    simulationTimeScale,
  });
  return Template.fromStack(stack);
}

describe("Nyc311OrderExecutionLambda", () => {
  it("bundles backend/controller/order-processing/orderExecutionController's exported handler on Node 22", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::Lambda::Function", {
      Handler: "index.orderExecutionController",
      Runtime: "nodejs22.x",
    });
  });

  it("suffixes the function name and log group by environment, distinguishing Test from Prod", () => {
    synthesize("TEST").hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311OrderExecution-Test" });
    synthesize("TEST").hasResourceProperties("AWS::Logs::LogGroup", {
      LogGroupName: "/aws/lambda/Nyc311OrderExecution-Test",
    });

    synthesize("PROD").hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311OrderExecution-Prod" });
  });

  it("passes the Orders/Operators table names and SIMULATION_TIME_SCALE as env vars", () => {
    const template = synthesize("TEST", 100);

    template.hasResourceProperties("AWS::Lambda::Function", {
      Environment: {
        Variables: {
          ORDERS_TABLE_NAME: { Ref: Match.stringLikeRegexp("^OrdersTable") },
          OPERATORS_TABLE_NAME: { Ref: Match.stringLikeRegexp("^OperatorsTable") },
          SIMULATION_TIME_SCALE: "100",
        },
      },
    });
  });

  it("passes a real-time scale of 1 for Prod", () => {
    const template = synthesize("PROD", 1);

    template.hasResourceProperties("AWS::Lambda::Function", {
      Environment: { Variables: Match.objectLike({ SIMULATION_TIME_SCALE: "1" }) },
    });
  });

  it("grants exactly GetItem/PutItem on Orders and Operators — no Query, this Lambda never scans/queries", () => {
    const template = synthesize("TEST");

    const policies = template.findResources("AWS::IAM::Policy");
    const allStatements = Object.values(policies).flatMap(
      (p) => (p.Properties as { PolicyDocument: { Statement: { Action: unknown }[] } }).PolicyDocument.Statement
    );
    const allActions = allStatements.flatMap((s) => (Array.isArray(s.Action) ? s.Action : [s.Action]));
    const dynamoActions = allActions.filter((a) => typeof a === "string" && a.startsWith("dynamodb:"));
    expect(new Set(dynamoActions)).toEqual(new Set(["dynamodb:GetItem", "dynamodb:PutItem"]));
  });

  it("does not pin reserved concurrency — the account's unraised concurrency quota (10) rejects any reservation", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::Lambda::Function", {
      ReservedConcurrentExecutions: Match.absent(),
    });
  });

  it("sets the log group to DESTROY so a failed first deploy's rollback doesn't orphan it", () => {
    const template = synthesize("TEST");

    template.hasResource("AWS::Logs::LogGroup", {
      DeletionPolicy: "Delete",
      UpdateReplacePolicy: "Delete",
    });
  });
});
