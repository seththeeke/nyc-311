import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { RequestsTable } from "../../data/RequestsTable";
import { Nyc311RequestEventsTopic } from "../../lambda/Nyc311RequestEventsTopic";
import { Nyc311RequestsFanOutLambda } from "../../lambda/Nyc311RequestsFanOutLambda";

function synthesize(envName: "TEST" | "PROD"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  const requestsTable = new RequestsTable(stack, "RequestsTable", { envName });
  const requestEventsTopic = new Nyc311RequestEventsTopic(stack, "Nyc311RequestEventsTopic", { envName });
  new Nyc311RequestsFanOutLambda(stack, "Nyc311RequestsFanOutLambda", { envName, requestsTable, requestEventsTopic });
  return Template.fromStack(stack);
}

describe("Nyc311RequestsFanOutLambda", () => {
  it("bundles fanOutRequestEventsController's exported handler on Node 22", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::Lambda::Function", {
      Handler: "index.fanOutRequestEventsController",
      Runtime: "nodejs22.x",
    });
  });

  it("suffixes the function name and log group by environment, distinguishing Test from Prod", () => {
    synthesize("TEST").hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311RequestsFanOut-Test" });
    synthesize("TEST").hasResourceProperties("AWS::Logs::LogGroup", {
      LogGroupName: "/aws/lambda/Nyc311RequestsFanOut-Test",
    });

    synthesize("PROD").hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311RequestsFanOut-Prod" });
    synthesize("PROD").hasResourceProperties("AWS::Logs::LogGroup", {
      LogGroupName: "/aws/lambda/Nyc311RequestsFanOut-Prod",
    });
  });

  it("passes the request-events topic's ARN as REQUEST_EVENTS_TOPIC_ARN", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::Lambda::Function", {
      Environment: {
        Variables: {
          REQUEST_EVENTS_TOPIC_ARN: { Ref: Match.stringLikeRegexp("^Nyc311RequestEventsTopic") },
        },
      },
    });
  });

  it("grants Publish (only) on the request-events topic, and no dynamodb:Put*/Update*/Delete* — no table write access", () => {
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
    /*
     * The only sqs:SendMessage grant is on this Lambda's own onFailure DLQ
     * (DynamoEventSource wires that) — it no longer sends to the ingestion
     * queue at all, that moved to an SNS subscription (7-data-warehousing.md §4).
     */
  });

  it("wires an event source mapping on the Requests table stream: batch 100, LATEST, per-item failure reporting, 3 retries, no FilterCriteria", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::Lambda::EventSourceMapping", {
      BatchSize: 100,
      StartingPosition: "LATEST",
      FunctionResponseTypes: ["ReportBatchItemFailures"],
      MaximumRetryAttempts: 3,
      EventSourceArn: {
        "Fn::GetAtt": [Match.stringLikeRegexp("^RequestsTable"), "StreamArn"],
      },
    });
    const mapping = template.findResources("AWS::Lambda::EventSourceMapping");
    const props = Object.values(mapping)[0]?.Properties as Record<string, unknown>;
    expect(props["FilterCriteria"]).toBeUndefined();
  });

  it("routes the event source mapping's onFailure to its own dedicated DLQ", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::SQS::Queue", { QueueName: "Nyc311RequestsFanOutDlq-Test" });
    template.hasResourceProperties("AWS::Lambda::EventSourceMapping", {
      DestinationConfig: {
        OnFailure: {
          Destination: { "Fn::GetAtt": [Match.stringLikeRegexp("^Nyc311RequestsFanOutLambdaOnFailureDlq"), "Arn"] },
        },
      },
    });
  });
});
