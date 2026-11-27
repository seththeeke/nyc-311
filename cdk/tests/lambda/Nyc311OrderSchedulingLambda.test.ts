import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import { describe, expect, it } from "vitest";
import { OrdersTable } from "../../data/OrdersTable";
import { RequestsTable } from "../../data/RequestsTable";
import { LocationsTable } from "../../data/LocationsTable";
import { OperatorsTable } from "../../data/OperatorsTable";
import { FeatureFlagsTable } from "../../data/FeatureFlagsTable";
import { Nyc311DispatchDecisionsTopic } from "../../lambda/Nyc311DispatchDecisionsTopic";
import { Nyc311OrderSchedulingLambda } from "../../lambda/Nyc311OrderSchedulingLambda";

const FAKE_STATE_MACHINE_ARN = "arn:aws:states:us-east-1:123456789012:stateMachine:Fake";

function synthesize(envName: "TEST" | "PROD"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  const ordersTable = new OrdersTable(stack, "OrdersTable", { envName });
  const requestsTable = new RequestsTable(stack, "RequestsTable", { envName });
  const locationsTable = new LocationsTable(stack, "LocationsTable", { envName });
  const operatorsTable = new OperatorsTable(stack, "OperatorsTable", { envName });
  const orderExecutionStateMachine = sfn.StateMachine.fromStateMachineArn(
    stack,
    "FakeStateMachine",
    FAKE_STATE_MACHINE_ARN
  );
  new Nyc311OrderSchedulingLambda(stack, "Nyc311OrderSchedulingLambda", {
    envName,
    ordersTable,
    requestsTable,
    locationsTable,
    operatorsTable,
    orderExecutionStateMachine,
    featureFlagsTable: new FeatureFlagsTable(stack, "FeatureFlagsTable", { envName }),
    dispatchDecisionsTopic: new Nyc311DispatchDecisionsTopic(stack, "Topic", { envName }).topic,
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

  it("sets the log group to DESTROY so a failed first deploy's rollback doesn't orphan it (blocks the next changeset's preflight)", () => {
    const template = synthesize("TEST");

    template.hasResource("AWS::Logs::LogGroup", {
      DeletionPolicy: "Delete",
      UpdateReplacePolicy: "Delete",
    });
  });

  it("passes the Orders/Requests/Locations/Operators table names and the execution state machine ARN as env vars", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::Lambda::Function", {
      Environment: {
        Variables: {
          ORDERS_TABLE_NAME: { Ref: Match.stringLikeRegexp("^OrdersTable") },
          REQUESTS_TABLE_NAME: { Ref: Match.stringLikeRegexp("^RequestsTable") },
          LOCATIONS_TABLE_NAME: { Ref: Match.stringLikeRegexp("^LocationsTable") },
          OPERATORS_TABLE_NAME: { Ref: Match.stringLikeRegexp("^OperatorsTable") },
          ORDER_EXECUTION_STATE_MACHINE_ARN: FAKE_STATE_MACHINE_ARN,
        },
      },
    });
  });

  it("grants GetItem/PutItem/Query on Orders and Operators, GetItem on Requests/Locations, and states:StartExecution on the execution state machine", () => {
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

  it("reads DISPATCH_POLICY with GetItem on the flag table only, and publishes dispatch decisions (20-ml-driver-assignment.md §2.4)", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "Nyc311OrderScheduling-Test",
      Environment: {
        Variables: Match.objectLike({
          FEATURE_FLAGS_TABLE_NAME: Match.anyValue(),
          DISPATCH_DECISIONS_TOPIC_ARN: Match.anyValue(),
        }),
      },
    });
    const statements = Object.values(template.findResources("AWS::IAM::Policy")).flatMap(
      (policy) => (policy.Properties as { PolicyDocument: { Statement: Record<string, unknown>[] } }).PolicyDocument.Statement
    );
    const flagRead = statements.filter((st) => JSON.stringify(st["Resource"]).includes("FeatureFlagsTable"));
    expect(flagRead.map((st) => st["Action"])).toEqual(["dynamodb:GetItem"]);
    const publish = statements.filter((st) => st["Action"] === "sns:Publish");
    expect(publish).toHaveLength(1);
    expect(JSON.stringify(publish[0]?.["Resource"])).toContain("Topic");
  });

  it("turns its FeatureFlagRead log lines into the #202 metrics", () => {
    synthesize("TEST").resourceCountIs("AWS::Logs::MetricFilter", 3);
  });
});
