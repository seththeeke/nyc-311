import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { OrdersTable } from "../../data/OrdersTable";
import { Nyc311OrderEventsTopic } from "../../lambda/Nyc311OrderEventsTopic";
import { Nyc311OrderProjectionsTopic } from "../../lambda/Nyc311OrderProjectionsTopic";
import { Nyc311OrdersStreamFanOutLambda } from "../../lambda/Nyc311OrdersStreamFanOutLambda";

function synthesize(envName: "TEST" | "PROD"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  const ordersTable = new OrdersTable(stack, "OrdersTable", { envName });
  const orderEventsTopic = new Nyc311OrderEventsTopic(stack, "Nyc311OrderEventsTopic", { envName });
  const orderProjectionsTopic = new Nyc311OrderProjectionsTopic(stack, "Nyc311OrderProjectionsTopic", { envName });
  new Nyc311OrdersStreamFanOutLambda(stack, "Nyc311OrdersStreamFanOutLambda", {
    envName,
    ordersTable,
    orderEventsTopic,
    orderProjectionsTopic,
  });
  return Template.fromStack(stack);
}

describe("Nyc311OrdersStreamFanOutLambda", () => {
  it("bundles fanOutOrdersStreamController's exported handler on Node 22", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::Lambda::Function", {
      Handler: "index.fanOutOrdersStreamController",
      Runtime: "nodejs22.x",
    });
  });

  it("suffixes the function name and log group by environment, distinguishing Test from Prod", () => {
    synthesize("TEST").hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "Nyc311OrdersStreamFanOut-Test",
    });
    synthesize("TEST").hasResourceProperties("AWS::Logs::LogGroup", {
      LogGroupName: "/aws/lambda/Nyc311OrdersStreamFanOut-Test",
    });

    synthesize("PROD").hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "Nyc311OrdersStreamFanOut-Prod",
    });
    synthesize("PROD").hasResourceProperties("AWS::Logs::LogGroup", {
      LogGroupName: "/aws/lambda/Nyc311OrdersStreamFanOut-Prod",
    });
  });

  it("passes both the events and projections topic ARNs as environment variables", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::Lambda::Function", {
      Environment: {
        Variables: {
          ORDER_EVENTS_TOPIC_ARN: { Ref: Match.stringLikeRegexp("^Nyc311OrderEventsTopic") },
          ORDER_PROJECTIONS_TOPIC_ARN: { Ref: Match.stringLikeRegexp("^Nyc311OrderProjectionsTopic") },
        },
      },
    });
  });

  it("grants Publish (only) on both topics, and no dynamodb:Put*/Update*/Delete* — no Orders table write access", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::IAM::Policy", {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([Match.objectLike({ Action: "sns:Publish", Effect: "Allow" })]),
      }),
    });

    const policies = template.findResources("AWS::IAM::Policy");
    const allStatements = Object.values(policies).flatMap(
      (p) => (p.Properties as { PolicyDocument: { Statement: { Action: unknown }[] } }).PolicyDocument.Statement
    );
    const allActions = allStatements.flatMap((s) => (Array.isArray(s.Action) ? s.Action : [s.Action]));
    expect(allActions.some((a) => typeof a === "string" && /^dynamodb:(Put|Update|Delete)/.test(a))).toBe(false);
  });

  it("wires an event source mapping on the Orders table stream: batch 100, LATEST, per-item failure reporting, 3 retries, no FilterCriteria", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::Lambda::EventSourceMapping", {
      BatchSize: 100,
      StartingPosition: "LATEST",
      FunctionResponseTypes: ["ReportBatchItemFailures"],
      MaximumRetryAttempts: 3,
      EventSourceArn: {
        "Fn::GetAtt": [Match.stringLikeRegexp("^OrdersTable"), "StreamArn"],
      },
    });
    const mapping = template.findResources("AWS::Lambda::EventSourceMapping");
    const props = Object.values(mapping)[0]?.Properties as Record<string, unknown>;
    expect(props["FilterCriteria"]).toBeUndefined();
  });

  it("routes the event source mapping's onFailure to its own dedicated DLQ", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::SQS::Queue", { QueueName: "Nyc311OrdersStreamFanOutDlq-Test" });
    template.hasResourceProperties("AWS::Lambda::EventSourceMapping", {
      DestinationConfig: {
        OnFailure: {
          Destination: {
            "Fn::GetAtt": [Match.stringLikeRegexp("^Nyc311OrdersStreamFanOutLambdaOnFailureDlq"), "Arn"],
          },
        },
      },
    });
  });
});
