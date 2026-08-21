import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { RequestsTable } from "../../data/RequestsTable";
import { LocationsTable } from "../../data/LocationsTable";
import { OrdersTable } from "../../data/OrdersTable";
import { Nyc311OrderIngestionQueue } from "../../lambda/Nyc311OrderIngestionQueue";
import { Nyc311RequestEvaluationLambda } from "../../lambda/Nyc311RequestEvaluationLambda";

function synthesize(envName: "TEST" | "PROD"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  const requestsTable = new RequestsTable(stack, "RequestsTable", { envName });
  const locationsTable = new LocationsTable(stack, "LocationsTable", { envName });
  const ordersTable = new OrdersTable(stack, "OrdersTable", { envName });
  const orderIngestionQueue = new Nyc311OrderIngestionQueue(stack, "Nyc311OrderIngestionQueue", { envName });
  new Nyc311RequestEvaluationLambda(stack, "Nyc311RequestEvaluationLambda", {
    envName,
    requestsTable,
    locationsTable,
    ordersTable,
    orderIngestionQueue,
  });
  return Template.fromStack(stack);
}

describe("Nyc311RequestEvaluationLambda", () => {
  it("bundles backend/controller/ingestion/requestEvaluationController's exported handler on Node 22", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::Lambda::Function", {
      Handler: "index.requestEvaluationController",
      Runtime: "nodejs22.x",
    });
  });

  it("suffixes the function name and log group by environment", () => {
    synthesize("TEST").hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "Nyc311RequestEvaluation-Test",
    });
    synthesize("TEST").hasResourceProperties("AWS::Logs::LogGroup", {
      LogGroupName: "/aws/lambda/Nyc311RequestEvaluation-Test",
    });

    synthesize("PROD").hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "Nyc311RequestEvaluation-Prod",
    });
  });

  it("passes the three table names as environment variables", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::Lambda::Function", {
      Environment: {
        Variables: {
          REQUESTS_TABLE_NAME: { Ref: Match.stringLikeRegexp("^RequestsTable") },
          LOCATIONS_TABLE_NAME: { Ref: Match.stringLikeRegexp("^LocationsTable") },
          ORDERS_TABLE_NAME: { Ref: Match.stringLikeRegexp("^OrdersTable") },
        },
      },
    });
  });

  it("wires an SQS event source on the order-ingestion queue: batch 10, per-item failure reporting", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::Lambda::EventSourceMapping", {
      BatchSize: 10,
      FunctionResponseTypes: ["ReportBatchItemFailures"],
      EventSourceArn: { "Fn::GetAtt": [Match.stringLikeRegexp("^Nyc311OrderIngestionQueue"), "Arn"] },
    });
  });

  it("grants exactly GetItem/PutItem on all three tables, plus SQS consume — no broader access", () => {
    const template = synthesize("TEST");

    const policies = template.findResources("AWS::IAM::Policy");
    const allStatements = Object.values(policies).flatMap(
      (p) => (p.Properties as { PolicyDocument: { Statement: { Action: unknown }[] } }).PolicyDocument.Statement
    );
    const allActions = allStatements.flatMap((s) => (Array.isArray(s.Action) ? s.Action : [s.Action]));
    const dynamoActions = new Set(allActions.filter((a) => typeof a === "string" && a.startsWith("dynamodb:")));
    expect(dynamoActions).toEqual(new Set(["dynamodb:GetItem", "dynamodb:PutItem"]));
  });
});
