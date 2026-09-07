import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { LocationsTable } from "../../data/LocationsTable";
import { Nyc311LocationEventsTopic } from "../../lambda/Nyc311LocationEventsTopic";
import { Nyc311LocationsFanOutLambda } from "../../lambda/Nyc311LocationsFanOutLambda";

function synthesize(envName: "TEST" | "PROD"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  const locationsTable = new LocationsTable(stack, "LocationsTable", { envName });
  const locationEventsTopic = new Nyc311LocationEventsTopic(stack, "Nyc311LocationEventsTopic", { envName });
  new Nyc311LocationsFanOutLambda(stack, "Nyc311LocationsFanOutLambda", { envName, locationsTable, locationEventsTopic });
  return Template.fromStack(stack);
}

describe("Nyc311LocationsFanOutLambda", () => {
  it("bundles fanOutLocationEventsController's exported handler on Node 22, named per environment", () => {
    synthesize("TEST").hasResourceProperties("AWS::Lambda::Function", {
      Handler: "index.fanOutLocationEventsController",
      Runtime: "nodejs22.x",
      FunctionName: "Nyc311LocationsFanOut-Test",
      Environment: {
        Variables: {
          LOCATION_EVENTS_TOPIC_ARN: { Ref: Match.stringLikeRegexp("^Nyc311LocationEventsTopic") },
        },
      },
    });
    synthesize("PROD").hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311LocationsFanOut-Prod" });
    synthesize("TEST").hasResourceProperties("AWS::Logs::LogGroup", {
      LogGroupName: "/aws/lambda/Nyc311LocationsFanOut-Test",
    });
  });

  it("grants sns:Publish only — no dynamodb:Put*/Update*/Delete* table write", () => {
    const template = synthesize("TEST");
    template.hasResourceProperties("AWS::IAM::Policy", {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([Match.objectLike({ Action: "sns:Publish", Effect: "Allow" })]),
      }),
    });

    const policies = template.findResources("AWS::IAM::Policy");
    const actions = Object.values(policies)
      .flatMap((p) => (p.Properties as { PolicyDocument: { Statement: { Action: unknown }[] } }).PolicyDocument.Statement)
      .flatMap((s) => (Array.isArray(s.Action) ? s.Action : [s.Action]));
    expect(actions.some((a) => typeof a === "string" && /^dynamodb:(Put|Update|Delete)/.test(a))).toBe(false);
  });

  it("wires an event source mapping on the Locations stream: batch 50, LATEST, per-item failure reporting, 3 retries, an onFailure DLQ", () => {
    const template = synthesize("TEST");
    template.hasResourceProperties("AWS::Lambda::EventSourceMapping", {
      BatchSize: 50,
      StartingPosition: "LATEST",
      FunctionResponseTypes: ["ReportBatchItemFailures"],
      MaximumRetryAttempts: 3,
      DestinationConfig: Match.objectLike({ OnFailure: Match.anyValue() }),
    });
    template.hasResourceProperties("AWS::SQS::Queue", { QueueName: "Nyc311LocationsFanOutDlq-Test" });
  });

  it("names the events topic per environment, SSL-enforced", () => {
    synthesize("TEST").hasResourceProperties("AWS::SNS::Topic", {
      TopicName: "Nyc311LocationEvents-Test",
    });
    synthesize("PROD").hasResourceProperties("AWS::SNS::Topic", { TopicName: "Nyc311LocationEvents-Prod" });
  });
});
