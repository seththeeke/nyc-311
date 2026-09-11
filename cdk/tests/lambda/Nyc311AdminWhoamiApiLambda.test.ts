import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, it } from "vitest";
import { UsersTable } from "../../data/UsersTable";
import { Nyc311AdminWhoamiApiLambda } from "../../lambda/Nyc311AdminWhoamiApiLambda";

function synthesize(envName: "TEST" | "PROD"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  const usersTable = new UsersTable(stack, "UsersTable", { envName });
  new Nyc311AdminWhoamiApiLambda(stack, "Nyc311AdminWhoamiApiLambda", { envName, usersTable });
  return Template.fromStack(stack);
}

describe("Nyc311AdminWhoamiApiLambda", () => {
  it("bundles backend/controller/web-api/whoamiController's exported handler on Node 22", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::Lambda::Function", {
      Handler: "index.whoamiController",
      Runtime: "nodejs22.x",
    });
  });

  it("suffixes the function name and log group by environment", () => {
    synthesize("TEST").hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311AdminWhoamiApi-Test" });
    synthesize("TEST").hasResourceProperties("AWS::Logs::LogGroup", {
      LogGroupName: "/aws/lambda/Nyc311AdminWhoamiApi-Test",
    });

    synthesize("PROD").hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311AdminWhoamiApi-Prod" });
  });

  it("passes the UsersTable's physical name as USERS_TABLE_NAME", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::Lambda::Function", {
      Environment: {
        Variables: {
          USERS_TABLE_NAME: { Ref: Match.stringLikeRegexp("^UsersTable") },
        },
      },
    });
  });

  it("grants only Query and PutItem on the UsersTable — no broader access", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::IAM::Policy", {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: ["dynamodb:Query", "dynamodb:PutItem"],
            Effect: "Allow",
          }),
        ]),
      }),
    });
  });
});
