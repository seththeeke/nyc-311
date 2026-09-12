import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, it } from "vitest";
import { OperatorsTable } from "../../data/OperatorsTable";
import { UsersTable } from "../../data/UsersTable";
import { Nyc311GetCapacityApiLambda } from "../../lambda/Nyc311GetCapacityApiLambda";

function synthesize(envName: "TEST" | "PROD"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  const operatorsTable = new OperatorsTable(stack, "OperatorsTable", { envName });
  const usersTable = new UsersTable(stack, "UsersTable", { envName });
  new Nyc311GetCapacityApiLambda(stack, "Nyc311GetCapacityApiLambda", { envName, operatorsTable, usersTable });
  return Template.fromStack(stack);
}

describe("Nyc311GetCapacityApiLambda", () => {
  it("bundles backend/controller/web-api/getCapacityController's exported handler on Node 22", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::Lambda::Function", {
      Handler: "index.getCapacityController",
      Runtime: "nodejs22.x",
    });
  });

  it("suffixes the function name and log group by environment", () => {
    synthesize("TEST").hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311GetCapacityApi-Test" });
    synthesize("TEST").hasResourceProperties("AWS::Logs::LogGroup", {
      LogGroupName: "/aws/lambda/Nyc311GetCapacityApi-Test",
    });

    synthesize("PROD").hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311GetCapacityApi-Prod" });
  });

  it("passes both table names as environment variables", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::Lambda::Function", {
      Environment: {
        Variables: {
          OPERATORS_TABLE_NAME: { Ref: Match.stringLikeRegexp("^OperatorsTable") },
          USERS_TABLE_NAME: { Ref: Match.stringLikeRegexp("^UsersTable") },
        },
      },
    });
  });

  it("grants only Query on OperatorsTable — read-only, no writes", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::IAM::Policy", {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([Match.objectLike({ Action: "dynamodb:Query", Effect: "Allow" })]),
      }),
    });
  });
});
