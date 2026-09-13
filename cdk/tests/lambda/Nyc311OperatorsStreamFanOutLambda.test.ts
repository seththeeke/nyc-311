import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { OperatorsTable } from "../../data/OperatorsTable";
import { Nyc311OperatorEventsTopic } from "../../lambda/Nyc311OperatorEventsTopic";
import { Nyc311OperatorProjectionsTopic } from "../../lambda/Nyc311OperatorProjectionsTopic";
import { Nyc311OperatorsStreamFanOutLambda } from "../../lambda/Nyc311OperatorsStreamFanOutLambda";

function synthesize(envName: "TEST" | "PROD"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  const operatorsTable = new OperatorsTable(stack, "OperatorsTable", { envName });
  const operatorEventsTopic = new Nyc311OperatorEventsTopic(stack, "Nyc311OperatorEventsTopic", { envName });
  const operatorProjectionsTopic = new Nyc311OperatorProjectionsTopic(stack, "Nyc311OperatorProjectionsTopic", {
    envName,
  });
  new Nyc311OperatorsStreamFanOutLambda(stack, "Nyc311OperatorsStreamFanOutLambda", {
    envName,
    operatorsTable,
    operatorEventsTopic,
    operatorProjectionsTopic,
  });
  return Template.fromStack(stack);
}

describe("Nyc311OperatorsStreamFanOutLambda", () => {
  it("bundles fanOutOperatorEventsController's exported handler on Node 22", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::Lambda::Function", {
      Handler: "index.fanOutOperatorEventsController",
      Runtime: "nodejs22.x",
    });
  });

  it("suffixes the function name and log group by environment, distinguishing Test from Prod", () => {
    synthesize("TEST").hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "Nyc311OperatorsStreamFanOut-Test",
    });
    synthesize("TEST").hasResourceProperties("AWS::Logs::LogGroup", {
      LogGroupName: "/aws/lambda/Nyc311OperatorsStreamFanOut-Test",
    });

    synthesize("PROD").hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "Nyc311OperatorsStreamFanOut-Prod",
    });
    synthesize("PROD").hasResourceProperties("AWS::Logs::LogGroup", {
      LogGroupName: "/aws/lambda/Nyc311OperatorsStreamFanOut-Prod",
    });
  });

  it("passes both the events and projections topic ARNs as environment variables", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::Lambda::Function", {
      Environment: {
        Variables: {
          OPERATOR_EVENTS_TOPIC_ARN: { Ref: Match.stringLikeRegexp("^Nyc311OperatorEventsTopic") },
          OPERATOR_PROJECTIONS_TOPIC_ARN: { Ref: Match.stringLikeRegexp("^Nyc311OperatorProjectionsTopic") },
        },
      },
    });
  });

  it("grants Publish (only) on both topics, and no dynamodb:Put*/Update*/Delete* — no Operators table write access", () => {
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

  it("wires an event source mapping on the Operators table stream: batch 100, LATEST, per-item failure reporting, 3 retries, no FilterCriteria", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::Lambda::EventSourceMapping", {
      BatchSize: 100,
      StartingPosition: "LATEST",
      FunctionResponseTypes: ["ReportBatchItemFailures"],
      MaximumRetryAttempts: 3,
      EventSourceArn: {
        "Fn::GetAtt": [Match.stringLikeRegexp("^OperatorsTable"), "StreamArn"],
      },
    });
    const mapping = template.findResources("AWS::Lambda::EventSourceMapping");
    const props = Object.values(mapping)[0]?.Properties as Record<string, unknown>;
    expect(props["FilterCriteria"]).toBeUndefined();
  });

  it("routes the event source mapping's onFailure to its own dedicated DLQ", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::SQS::Queue", { QueueName: "Nyc311OperatorsStreamFanOutDlq-Test" });
    template.hasResourceProperties("AWS::Lambda::EventSourceMapping", {
      DestinationConfig: {
        OnFailure: {
          Destination: {
            "Fn::GetAtt": [Match.stringLikeRegexp("^Nyc311OperatorsStreamFanOutLambdaOnFailureDlq"), "Arn"],
          },
        },
      },
    });
  });
});
