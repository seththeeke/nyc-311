import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import * as logs from "aws-cdk-lib/aws-logs";
import { describe, it } from "vitest";
import { FeatureFlagReadMetricFilters } from "../../lambda/FeatureFlagReadMetricFilters";

function synthesize(): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  const logGroup = new logs.LogGroup(stack, "CallerLogGroup", { logGroupName: "/aws/lambda/Caller-Test" });
  new FeatureFlagReadMetricFilters(stack, "FlagReadMetrics", { logGroup });
  return Template.fromStack(stack);
}

const BASE_PATTERN = '($.message = "FeatureFlagRead") && ($.functionName = "*") && ($.flagKey = "*")';
const DIMENSIONS = [
  { Key: "FunctionName", Value: "$.functionName" },
  { Key: "FlagKey", Value: "$.flagKey" },
];

describe("FeatureFlagReadMetricFilters (#202)", () => {
  it("creates exactly the three FeatureFlagRead filters on the given log group", () => {
    const template = synthesize();
    template.resourceCountIs("AWS::Logs::MetricFilter", 3);
    template.allResourcesProperties("AWS::Logs::MetricFilter", {
      LogGroupName: Match.objectLike({ Ref: Match.stringLikeRegexp("CallerLogGroup") }),
    });
  });

  it.each([
    ["FeatureFlagReadSucceeded", `{ ${BASE_PATTERN} && ($.outcome = "TREATMENT") }`, "1"],
    ["FeatureFlagReadFellBack", `{ ${BASE_PATTERN} && ($.outcome = "FALLBACK") }`, "1"],
    ["FeatureFlagReadDurationMs", `{ ${BASE_PATTERN} && ($.durationMs = "*") }`, "$.durationMs"],
  ])("%s filters FeatureFlagRead lines into Nyc311/FeatureFlags by FunctionName and FlagKey", (metricName, pattern, value) => {
    synthesize().hasResourceProperties("AWS::Logs::MetricFilter", {
      FilterPattern: pattern,
      MetricTransformations: [
        Match.objectLike({
          MetricName: metricName,
          MetricNamespace: "Nyc311/FeatureFlags",
          MetricValue: value,
          Dimensions: Match.arrayWith(DIMENSIONS.map((dimension) => Match.objectLike(dimension))),
        }),
      ],
    });
  });
});
