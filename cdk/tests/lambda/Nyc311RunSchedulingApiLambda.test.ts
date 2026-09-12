import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import { describe, expect, it } from "vitest";
import { OrdersTable } from "../../data/OrdersTable";
import { RequestsTable } from "../../data/RequestsTable";
import { LocationsTable } from "../../data/LocationsTable";
import { OperatorsTable } from "../../data/OperatorsTable";
import { UsersTable } from "../../data/UsersTable";
import { Nyc311RunSchedulingApiLambda } from "../../lambda/Nyc311RunSchedulingApiLambda";

const FAKE_STATE_MACHINE_ARN = "arn:aws:states:us-east-1:123456789012:stateMachine:Fake";

function synthesize(envName: "TEST" | "PROD" = "TEST"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  const ordersTable = new OrdersTable(stack, "OrdersTable", { envName });
  const requestsTable = new RequestsTable(stack, "RequestsTable", { envName });
  const locationsTable = new LocationsTable(stack, "LocationsTable", { envName });
  const operatorsTable = new OperatorsTable(stack, "OperatorsTable", { envName });
  const usersTable = new UsersTable(stack, "UsersTable", { envName });
  const orderExecutionStateMachine = sfn.StateMachine.fromStateMachineArn(
    stack,
    "FakeStateMachine",
    FAKE_STATE_MACHINE_ARN
  );
  new Nyc311RunSchedulingApiLambda(stack, "Nyc311RunSchedulingApiLambda", {
    envName,
    ordersTable,
    requestsTable,
    locationsTable,
    operatorsTable,
    usersTable,
    orderExecutionStateMachine,
  });
  return Template.fromStack(stack);
}

describe("Nyc311RunSchedulingApiLambda", () => {
  it("bundles backend/controller/web-api/runSchedulingController's exported handler on Node 22", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::Lambda::Function", {
      Handler: "index.runSchedulingController",
      Runtime: "nodejs22.x",
    });
  });

  it("suffixes the function name by environment, distinguishing Test from Prod", () => {
    synthesize("TEST").hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311RunSchedulingApi-Test" });
    synthesize("PROD").hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311RunSchedulingApi-Prod" });
  });

  it("passes every table name and the execution state machine ARN as env vars", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::Lambda::Function", {
      Environment: {
        Variables: {
          ORDERS_TABLE_NAME: { Ref: Match.stringLikeRegexp("^OrdersTable") },
          REQUESTS_TABLE_NAME: { Ref: Match.stringLikeRegexp("^RequestsTable") },
          LOCATIONS_TABLE_NAME: { Ref: Match.stringLikeRegexp("^LocationsTable") },
          OPERATORS_TABLE_NAME: { Ref: Match.stringLikeRegexp("^OperatorsTable") },
          USERS_TABLE_NAME: { Ref: Match.stringLikeRegexp("^UsersTable") },
          ORDER_EXECUTION_STATE_MACHINE_ARN: FAKE_STATE_MACHINE_ARN,
        },
      },
    });
  });

  it("grants GetItem/PutItem/Query on Orders/Operators/Users, GetItem on Requests/Locations, and states:StartExecution", () => {
    const template = synthesize("TEST");

    const policies = template.findResources("AWS::IAM::Policy");
    const allStatements = Object.values(policies).flatMap(
      (p) => (p.Properties as { PolicyDocument: { Statement: { Action: unknown }[] } }).PolicyDocument.Statement
    );
    const allActions = allStatements.flatMap((s) => (Array.isArray(s.Action) ? s.Action : [s.Action]));
    const dynamoActions = allActions.filter((a) => typeof a === "string" && a.startsWith("dynamodb:"));
    expect(new Set(dynamoActions)).toEqual(new Set(["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:Query"]));
    expect(allActions).toContain("states:StartExecution");
  });
});
