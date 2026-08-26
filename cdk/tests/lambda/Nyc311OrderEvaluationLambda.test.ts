import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { OrdersTable } from "../../data/OrdersTable";
import { Nyc311OrderEventsTopic } from "../../lambda/Nyc311OrderEventsTopic";
import { Nyc311OrderEvaluationQueue } from "../../lambda/Nyc311OrderEvaluationQueue";
import { Nyc311OrderEvaluationLambda } from "../../lambda/Nyc311OrderEvaluationLambda";

function synthesize(envName: "TEST" | "PROD"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  const ordersTable = new OrdersTable(stack, "OrdersTable", { envName });
  const orderEventsTopic = new Nyc311OrderEventsTopic(stack, "Nyc311OrderEventsTopic", { envName });
  const orderEvaluationQueue = new Nyc311OrderEvaluationQueue(stack, "Nyc311OrderEvaluationQueue", {
    envName,
    orderEventsTopic,
  });
  new Nyc311OrderEvaluationLambda(stack, "Nyc311OrderEvaluationLambda", { envName, ordersTable, orderEvaluationQueue });
  return Template.fromStack(stack);
}

describe("Nyc311OrderEvaluationLambda", () => {
  it("bundles backend/controller/order-processing/evaluateOrderController's exported handler on Node 22", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::Lambda::Function", {
      Handler: "index.evaluateOrderController",
      Runtime: "nodejs22.x",
    });
  });

  it("suffixes the function name and log group by environment, distinguishing Test from Prod", () => {
    synthesize("TEST").hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311OrderEvaluation-Test" });
    synthesize("TEST").hasResourceProperties("AWS::Logs::LogGroup", {
      LogGroupName: "/aws/lambda/Nyc311OrderEvaluation-Test",
    });

    synthesize("PROD").hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311OrderEvaluation-Prod" });
  });

  it("passes the Orders table name as ORDERS_TABLE_NAME", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::Lambda::Function", {
      Environment: { Variables: { ORDERS_TABLE_NAME: { Ref: Match.stringLikeRegexp("^OrdersTable") } } },
    });
  });

  it("wires an SQS event source mapping on the evaluation queue, batch 10, per-item failure reporting", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::Lambda::EventSourceMapping", {
      BatchSize: 10,
      FunctionResponseTypes: ["ReportBatchItemFailures"],
      EventSourceArn: { "Fn::GetAtt": [Match.stringLikeRegexp("^Nyc311OrderEvaluationQueue"), "Arn"] },
    });
  });

  it("grants exactly GetItem/PutItem on Orders — no broader dynamodb action", () => {
    const template = synthesize("TEST");

    const policies = template.findResources("AWS::IAM::Policy");
    const allStatements = Object.values(policies).flatMap(
      (p) => (p.Properties as { PolicyDocument: { Statement: { Action: unknown }[] } }).PolicyDocument.Statement
    );
    const allActions = allStatements.flatMap((s) => (Array.isArray(s.Action) ? s.Action : [s.Action]));
    const dynamoActions = allActions.filter((a) => typeof a === "string" && a.startsWith("dynamodb:"));
    expect(new Set(dynamoActions)).toEqual(new Set(["dynamodb:GetItem", "dynamodb:PutItem"]));
  });
});
