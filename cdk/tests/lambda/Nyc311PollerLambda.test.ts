import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, it } from "vitest";
import { RequestsTable } from "../../data/RequestsTable";
import { Nyc311PollerLambda } from "../../lambda/Nyc311PollerLambda";

function synthesize(envName: "TEST" | "PROD"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  const requestsTable = new RequestsTable(stack, "RequestsTable", { envName });
  new Nyc311PollerLambda(stack, "Nyc311PollerLambda", { envName, requestsTable });
  return Template.fromStack(stack);
}

describe("Nyc311PollerLambda", () => {
  it("bundles backend/controller/ingestion/nyc311PollerController's exported handler on Node 22", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::Lambda::Function", {
      Handler: "index.nyc311PollerController",
      Runtime: "nodejs22.x",
    });
  });

  it("suffixes the function name and log group by environment, distinguishing Test from Prod at a glance", () => {
    synthesize("TEST").hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311Poller-Test" });
    synthesize("TEST").hasResourceProperties("AWS::Logs::LogGroup", { LogGroupName: "/aws/lambda/Nyc311Poller-Test" });

    synthesize("PROD").hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311Poller-Prod" });
    synthesize("PROD").hasResourceProperties("AWS::Logs::LogGroup", { LogGroupName: "/aws/lambda/Nyc311Poller-Prod" });
  });

  it("passes the RequestsTable's physical name as REQUESTS_TABLE_NAME", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::Lambda::Function", {
      Environment: {
        Variables: {
          REQUESTS_TABLE_NAME: { Ref: Match.stringLikeRegexp("^RequestsTable") },
        },
      },
    });
  });

  it("grants only GetItem/PutItem/Query on the RequestsTable (table + indexes) — least privilege", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::IAM::Policy", {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:Query"],
            Effect: "Allow",
          }),
        ]),
      }),
    });
  });

  it("creates no custom MetricFilters in TEST", () => {
    const template = synthesize("TEST");

    template.resourceCountIs("AWS::Logs::MetricFilter", 0);
  });

  it("creates exactly 3 custom MetricFilters in PROD, one per PollCompleted field, capped well under 10", () => {
    const template = synthesize("PROD");

    template.resourceCountIs("AWS::Logs::MetricFilter", 3);
    for (const [metricName, jsonField] of [
      ["RecordsIngested", "records_ingested"],
      ["DuplicatesSkipped", "duplicates_skipped"],
      ["RecordsRejected", "records_rejected"],
    ]) {
      template.hasResourceProperties("AWS::Logs::MetricFilter", {
        FilterPattern: `{ ($.message = "PollCompleted") && ($.${jsonField} = "*") }`,
        MetricTransformations: [
          Match.objectLike({
            MetricName: metricName,
            MetricNamespace: "Nyc311/Ingestion",
            MetricValue: `$.${jsonField}`,
          }),
        ],
      });
    }
  });
});
