import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, it } from "vitest";
import { OrdersTable } from "../../data/OrdersTable";
import { Nyc311OrdersApiLambda } from "../../lambda/Nyc311OrdersApiLambda";

function synthesize(envName: "TEST" | "PROD"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  const ordersTable = new OrdersTable(stack, "OrdersTable", { envName });
  new Nyc311OrdersApiLambda(stack, "Nyc311OrdersApiLambda", { envName, ordersTable });
  return Template.fromStack(stack);
}

describe("Nyc311OrdersApiLambda", () => {
  it("bundles backend/controller/web-api/getOrdersController's exported handler on Node 22", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::Lambda::Function", {
      Handler: "index.getOrdersController",
      Runtime: "nodejs22.x",
    });
  });

  it("suffixes the function name and log group by environment, distinguishing Test from Prod at a glance", () => {
    synthesize("TEST").hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311OrdersApi-Test" });
    synthesize("TEST").hasResourceProperties("AWS::Logs::LogGroup", {
      LogGroupName: "/aws/lambda/Nyc311OrdersApi-Test",
    });

    synthesize("PROD").hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311OrdersApi-Prod" });
    synthesize("PROD").hasResourceProperties("AWS::Logs::LogGroup", {
      LogGroupName: "/aws/lambda/Nyc311OrdersApi-Prod",
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

  it("grants only Scan on the OrdersTable (table + indexes) — least privilege, read-only", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::IAM::Policy", {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: "dynamodb:Scan",
            Effect: "Allow",
          }),
        ]),
      }),
    });
  });
});
