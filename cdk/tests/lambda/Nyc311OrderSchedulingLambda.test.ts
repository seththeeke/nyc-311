import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { OrdersTable } from "../../data/OrdersTable";
import { RequestsTable } from "../../data/RequestsTable";
import { LocationsTable } from "../../data/LocationsTable";
import { Nyc311OrderSchedulingLambda } from "../../lambda/Nyc311OrderSchedulingLambda";

function synthesize(envName: "TEST" | "PROD"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  const ordersTable = new OrdersTable(stack, "OrdersTable", { envName });
  const requestsTable = new RequestsTable(stack, "RequestsTable", { envName });
  const locationsTable = new LocationsTable(stack, "LocationsTable", { envName });
  new Nyc311OrderSchedulingLambda(stack, "Nyc311OrderSchedulingLambda", {
    envName,
    ordersTable,
    requestsTable,
    locationsTable,
  });
  return Template.fromStack(stack);
}

describe("Nyc311OrderSchedulingLambda", () => {
  it("bundles backend/controller/order-processing/scheduleOrdersController's exported handler on Node 22", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::Lambda::Function", {
      Handler: "index.scheduleOrdersController",
      Runtime: "nodejs22.x",
    });
  });

  it("suffixes the function name and log group by environment, distinguishing Test from Prod", () => {
    synthesize("TEST").hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311OrderScheduling-Test" });
    synthesize("TEST").hasResourceProperties("AWS::Logs::LogGroup", {
      LogGroupName: "/aws/lambda/Nyc311OrderScheduling-Test",
    });

    synthesize("PROD").hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311OrderScheduling-Prod" });
  });

  it("does not pin reserved concurrency — the account's unraised concurrency quota (10) rejects any reservation", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::Lambda::Function", {
      ReservedConcurrentExecutions: Match.absent(),
    });
  });

  it("passes the Orders/Requests/Locations table names as env vars", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::Lambda::Function", {
      Environment: {
        Variables: {
          ORDERS_TABLE_NAME: { Ref: Match.stringLikeRegexp("^OrdersTable") },
          REQUESTS_TABLE_NAME: { Ref: Match.stringLikeRegexp("^RequestsTable") },
          LOCATIONS_TABLE_NAME: { Ref: Match.stringLikeRegexp("^LocationsTable") },
        },
      },
    });
  });

  it("grants exactly GetItem/PutItem/Query on Orders, GetItem on Requests/Locations — no Operators/Cases grants", () => {
    const template = synthesize("TEST");

    const policies = template.findResources("AWS::IAM::Policy");
    const allStatements = Object.values(policies).flatMap(
      (p) => (p.Properties as { PolicyDocument: { Statement: { Action: unknown }[] } }).PolicyDocument.Statement
    );
    const allActions = allStatements.flatMap((s) => (Array.isArray(s.Action) ? s.Action : [s.Action]));
    const dynamoActions = allActions.filter((a) => typeof a === "string" && a.startsWith("dynamodb:"));
    expect(new Set(dynamoActions)).toEqual(new Set(["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:Query"]));
  });
});
