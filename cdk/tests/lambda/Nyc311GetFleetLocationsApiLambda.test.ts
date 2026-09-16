import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { OperatorsTable } from "../../data/OperatorsTable";
import { OrdersTable } from "../../data/OrdersTable";
import { LocationsTable } from "../../data/LocationsTable";
import { Nyc311GetFleetLocationsApiLambda } from "../../lambda/Nyc311GetFleetLocationsApiLambda";

function synthesize(envName: "TEST" | "PROD"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  const operatorsTable = new OperatorsTable(stack, "OperatorsTable", { envName });
  const ordersTable = new OrdersTable(stack, "OrdersTable", { envName });
  const locationsTable = new LocationsTable(stack, "LocationsTable", { envName });
  new Nyc311GetFleetLocationsApiLambda(stack, "Nyc311GetFleetLocationsApiLambda", {
    envName,
    operatorsTable,
    ordersTable,
    locationsTable,
  });
  return Template.fromStack(stack);
}

describe("Nyc311GetFleetLocationsApiLambda", () => {
  it("bundles backend/controller/web-api/getFleetLocationsController's exported handler on Node 22", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::Lambda::Function", {
      Handler: "index.getFleetLocationsController",
      Runtime: "nodejs22.x",
    });
  });

  it("suffixes the function name and log group by environment", () => {
    synthesize("TEST").hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311GetFleetLocationsApi-Test" });
    synthesize("TEST").hasResourceProperties("AWS::Logs::LogGroup", {
      LogGroupName: "/aws/lambda/Nyc311GetFleetLocationsApi-Test",
    });

    synthesize("PROD").hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311GetFleetLocationsApi-Prod" });
  });

  it("passes Operators/Orders/Locations table names as env vars — no UsersTable, this route is public", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::Lambda::Function", {
      Environment: {
        Variables: {
          OPERATORS_TABLE_NAME: { Ref: Match.stringLikeRegexp("^OperatorsTable") },
          ORDERS_TABLE_NAME: { Ref: Match.stringLikeRegexp("^OrdersTable") },
          LOCATIONS_TABLE_NAME: { Ref: Match.stringLikeRegexp("^LocationsTable") },
        },
      },
    });
  });

  it("grants only Query (Operators, Orders) and GetItem (Locations) — read-only, no writes", () => {
    const template = synthesize("TEST");

    const policies = template.findResources("AWS::IAM::Policy");
    const allStatements = Object.values(policies).flatMap(
      (p) => (p.Properties as { PolicyDocument: { Statement: { Action: unknown }[] } }).PolicyDocument.Statement
    );
    const allActions = allStatements.flatMap((s) => (Array.isArray(s.Action) ? s.Action : [s.Action]));
    expect(new Set(allActions.filter((a) => typeof a === "string" && a.startsWith("dynamodb:")))).toEqual(
      new Set(["dynamodb:Query", "dynamodb:GetItem"])
    );
  });
});
