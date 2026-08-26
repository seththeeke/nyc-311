import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, it } from "vitest";
import { OrdersTable } from "../../data/OrdersTable";
import { Nyc311OrderEventsApiLambda } from "../../lambda/Nyc311OrderEventsApiLambda";

function synthesize(envName: "TEST" | "PROD"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  const ordersTable = new OrdersTable(stack, "OrdersTable", { envName });
  new Nyc311OrderEventsApiLambda(stack, "Nyc311OrderEventsApiLambda", { envName, ordersTable });
  return Template.fromStack(stack);
}

describe("Nyc311OrderEventsApiLambda", () => {
  it("bundles backend/controller/web-api/getOrderEventsController's exported handler on Node 22", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::Lambda::Function", {
      Handler: "index.getOrderEventsController",
      Runtime: "nodejs22.x",
    });
  });

  it("suffixes the function name and log group by environment, distinguishing Test from Prod at a glance", () => {
    synthesize("TEST").hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311OrderEventsApi-Test" });
    synthesize("TEST").hasResourceProperties("AWS::Logs::LogGroup", {
      LogGroupName: "/aws/lambda/Nyc311OrderEventsApi-Test",
    });

    synthesize("PROD").hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311OrderEventsApi-Prod" });
    synthesize("PROD").hasResourceProperties("AWS::Logs::LogGroup", {
      LogGroupName: "/aws/lambda/Nyc311OrderEventsApi-Prod",
    });
  });

  it("passes the OrdersTable's physical name as ORDERS_TABLE_NAME", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::Lambda::Function", {
      Environment: {
        Variables: {
          ORDERS_TABLE_NAME: { Ref: Match.stringLikeRegexp("^OrdersTable") },
        },
      },
    });
  });

  it("grants Scan and Query on the OrdersTable — least privilege, read-only", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::IAM::Policy", {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: ["dynamodb:Scan", "dynamodb:Query"],
            Effect: "Allow",
          }),
        ]),
      }),
    });
  });
});
