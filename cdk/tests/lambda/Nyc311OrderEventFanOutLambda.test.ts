import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { OrdersTable } from "../../data/OrdersTable";
import { Nyc311OrderEventsTopic } from "../../lambda/Nyc311OrderEventsTopic";
import { Nyc311OrderEventFanOutLambda } from "../../lambda/Nyc311OrderEventFanOutLambda";

function synthesize(envName: "TEST" | "PROD"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  const ordersTable = new OrdersTable(stack, "OrdersTable", { envName });
  const orderEventsTopic = new Nyc311OrderEventsTopic(stack, "Nyc311OrderEventsTopic", { envName });
  new Nyc311OrderEventFanOutLambda(stack, "Nyc311OrderEventFanOutLambda", { envName, ordersTable, orderEventsTopic });
  return Template.fromStack(stack);
}

describe("Nyc311OrderEventFanOutLambda", () => {
  it("bundles backend/controller/order-processing/fanOutOrderEventsController's exported handler on Node 22", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::Lambda::Function", {
      Handler: "index.fanOutOrderEventsController",
      Runtime: "nodejs22.x",
    });
  });

  it("suffixes the function name and log group by environment, distinguishing Test from Prod", () => {
    synthesize("TEST").hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "Nyc311OrderEventFanOut-Test",
    });
    synthesize("TEST").hasResourceProperties("AWS::Logs::LogGroup", {
      LogGroupName: "/aws/lambda/Nyc311OrderEventFanOut-Test",
    });

    synthesize("PROD").hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "Nyc311OrderEventFanOut-Prod",
    });
    synthesize("PROD").hasResourceProperties("AWS::Logs::LogGroup", {
      LogGroupName: "/aws/lambda/Nyc311OrderEventFanOut-Prod",
    });
  });

  it("passes the order-events topic's ARN as ORDER_EVENTS_TOPIC_ARN", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::Lambda::Function", {
      Environment: {
        Variables: {
          ORDER_EVENTS_TOPIC_ARN: { Ref: Match.stringLikeRegexp("^Nyc311OrderEventsTopic") },
        },
      },
    });
  });

  it("grants Publish on the order-events topic, and no dynamodb:Put*/Update*/Delete* at all — no Orders table write access", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::IAM::Policy", {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: "sns:Publish",
            Effect: "Allow",
          }),
        ]),
      }),
    });

    const policies = template.findResources("AWS::IAM::Policy");
    const allStatements = Object.values(policies).flatMap(
      (p) => (p.Properties as { PolicyDocument: { Statement: { Action: unknown }[] } }).PolicyDocument.Statement
    );
    const allActions = allStatements.flatMap((s) => (Array.isArray(s.Action) ? s.Action : [s.Action]));
    expect(allActions.some((a) => typeof a === "string" && /^dynamodb:(Put|Update|Delete)/.test(a))).toBe(false);
    /*
     * grantStreamRead (DescribeStream/GetRecords/GetShardIterator/ListStreams)
     * is granted automatically by DynamoEventSource.bind() — asserted by the
     * event source mapping existing at all (next test), not a separate
     * hand-rolled IAM statement here.
     */
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

  it("routes the event source mapping's onFailure to its own dedicated DLQ, distinct from any other DLQ in the stack", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::SQS::Queue", { QueueName: "Nyc311OrderEventFanOutDlq-Test" });
    template.hasResourceProperties("AWS::Lambda::EventSourceMapping", {
      DestinationConfig: {
        OnFailure: {
          Destination: {
            "Fn::GetAtt": [Match.stringLikeRegexp("^Nyc311OrderEventFanOutLambdaOnFailureDlq"), "Arn"],
          },
        },
      },
    });
  });
});
