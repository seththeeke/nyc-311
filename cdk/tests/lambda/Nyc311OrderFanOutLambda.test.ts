import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { RequestsTable } from "../../data/RequestsTable";
import { Nyc311OrderIngestionQueue } from "../../lambda/Nyc311OrderIngestionQueue";
import { Nyc311OrderFanOutLambda } from "../../lambda/Nyc311OrderFanOutLambda";

function synthesize(envName: "TEST" | "PROD"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  const requestsTable = new RequestsTable(stack, "RequestsTable", { envName });
  const orderIngestionQueue = new Nyc311OrderIngestionQueue(stack, "Nyc311OrderIngestionQueue", { envName });
  new Nyc311OrderFanOutLambda(stack, "Nyc311OrderFanOutLambda", { envName, requestsTable, orderIngestionQueue });
  return Template.fromStack(stack);
}

describe("Nyc311OrderFanOutLambda", () => {
  it("bundles backend/controller/order-request-processing/fanOutRequestEventsController's exported handler on Node 22", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::Lambda::Function", {
      Handler: "index.fanOutRequestEventsController",
      Runtime: "nodejs22.x",
    });
  });

  it("suffixes the function name and log group by environment, distinguishing Test from Prod", () => {
    synthesize("TEST").hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311OrderFanOut-Test" });
    synthesize("TEST").hasResourceProperties("AWS::Logs::LogGroup", {
      LogGroupName: "/aws/lambda/Nyc311OrderFanOut-Test",
    });

    synthesize("PROD").hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311OrderFanOut-Prod" });
    synthesize("PROD").hasResourceProperties("AWS::Logs::LogGroup", {
      LogGroupName: "/aws/lambda/Nyc311OrderFanOut-Prod",
    });
  });

  it("passes the order-ingestion queue's URL as ORDER_INGESTION_QUEUE_URL", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::Lambda::Function", {
      Environment: {
        Variables: {
          ORDER_INGESTION_QUEUE_URL: { Ref: Match.stringLikeRegexp("^Nyc311OrderIngestionQueue") },
        },
      },
    });
  });

  it("grants SendMessage on the order-ingestion queue, and no dynamodb:Put*/Update*/Delete* at all — no Requests/Orders table write access", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::IAM::Policy", {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: Match.arrayWith(["sqs:SendMessage"]),
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
    // grantStreamRead (DescribeStream/GetRecords/GetShardIterator/ListStreams)
    // is granted automatically by DynamoEventSource.bind() — asserted by the
    // event source mapping existing at all (next test), not a separate
    // hand-rolled IAM statement here.
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

  it("routes the event source mapping's onFailure to its own dedicated DLQ, distinct from the order-ingestion queue's own DLQ", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::SQS::Queue", { QueueName: "Nyc311OrderFanOutDlq-Test" });
    template.hasResourceProperties("AWS::Lambda::EventSourceMapping", {
      DestinationConfig: {
        OnFailure: {
          Destination: { "Fn::GetAtt": [Match.stringLikeRegexp("^Nyc311OrderFanOutLambdaOnFailureDlq"), "Arn"] },
        },
      },
    });
  });
});
