import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { WebhookSubscriptionsTable } from "../../data/WebhookSubscriptionsTable";
import { Nyc311RegisterWebhookSubscriptionApiLambda } from "../../lambda/Nyc311RegisterWebhookSubscriptionApiLambda";
import { dynamoActionsOn, ssmGrants } from "./webhookTestSupport";

function synthesize(envName: "TEST" | "PROD"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  new Nyc311RegisterWebhookSubscriptionApiLambda(stack, "Nyc311RegisterWebhookSubscriptionApiLambda", {
    envName,
    webhookSubscriptionsTable: new WebhookSubscriptionsTable(stack, "WebhookSubscriptionsTable", { envName }),
  });
  return Template.fromStack(stack);
}

describe("Nyc311RegisterWebhookSubscriptionApiLambda", () => {
  it("bundles backend/controller/web-api/registerWebhookSubscriptionController's exported handler on Node 22", () => {
    synthesize("TEST").hasResourceProperties("AWS::Lambda::Function", {
      Handler: "index.registerWebhookSubscriptionController",
      Runtime: "nodejs22.x",
      Timeout: 10,
    });
  });

  it("suffixes the function name and log group by environment", () => {
    const test = synthesize("TEST");
    test.hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311RegisterWebhookSubscriptionApi-Test" });
    test.hasResourceProperties("AWS::Logs::LogGroup", {
      LogGroupName: "/aws/lambda/Nyc311RegisterWebhookSubscriptionApi-Test",
      RetentionInDays: 30,
    });
    test.hasResource("AWS::Logs::LogGroup", { DeletionPolicy: "Delete" });
    synthesize("PROD").hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311RegisterWebhookSubscriptionApi-Prod" });
  });

  it("is given its environment's SSM prefix and callback-host allowlist", () => {
    synthesize("TEST").hasResourceProperties("AWS::Lambda::Function", {
      Environment: {
        Variables: {
          WEBHOOK_SUBSCRIPTIONS_TABLE_NAME: { Ref: Match.stringLikeRegexp("^WebhookSubscriptionsTable") },
          WEBHOOK_SSM_PREFIX: "/nyc311/test/webhook",
          WEBHOOK_ALLOWED_CALLBACK_HOSTS: "api.test.boroughsim.com",
        },
      },
    });
    synthesize("PROD").hasResourceProperties("AWS::Lambda::Function", {
      Environment: {
        Variables: Match.objectLike({
          WEBHOOK_SSM_PREFIX: "/nyc311/prod/webhook",
          WEBHOOK_ALLOWED_CALLBACK_HOSTS: "customer-api.boroughsim.com",
        }),
      },
    });
  });

  it("may read the registration key and write subscription secrets — never read a secret back", () => {
    const test = synthesize("TEST");
    expect(dynamoActionsOn(test, "WebhookSubscriptionsTable")).toEqual(["dynamodb:PutItem", "dynamodb:Scan"]);
    expect(ssmGrants(test)).toEqual([
      "ssm:GetParameter /nyc311/test/webhook/registration-key",
      "ssm:PutParameter /nyc311/test/webhook/*/secret",
    ]);
    expect(ssmGrants(synthesize("PROD"))).toEqual([
      "ssm:GetParameter /nyc311/prod/webhook/registration-key",
      "ssm:PutParameter /nyc311/prod/webhook/*/secret",
    ]);
  });
});
