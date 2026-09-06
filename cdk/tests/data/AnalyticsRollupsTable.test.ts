import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, it } from "vitest";
import { AnalyticsRollupsTable } from "../../data/AnalyticsRollupsTable";

function synthesize(envName: "TEST" | "PROD"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  new AnalyticsRollupsTable(stack, "AnalyticsRollupsTable", { envName });
  return Template.fromStack(stack);
}

describe("AnalyticsRollupsTable", () => {
  it("keys on metric_view + rollup_key, PITR enabled, RETAIN, no GSI", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::DynamoDB::GlobalTable", {
      KeySchema: [
        { AttributeName: "metric_view", KeyType: "HASH" },
        { AttributeName: "rollup_key", KeyType: "RANGE" },
      ],
      Replicas: Match.arrayWith([
        Match.objectLike({ PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true } }),
      ]),
    });
    template.hasResource("AWS::DynamoDB::GlobalTable", {
      DeletionPolicy: "Retain",
      UpdateReplacePolicy: "Retain",
    });
    const table = template.findResources("AWS::DynamoDB::GlobalTable");
    const props = Object.values(table)[0].Properties as Record<string, unknown>;
    if ("GlobalSecondaryIndexes" in props) throw new Error("AnalyticsRollupsTable should declare no GSI");
  });

  it("suffixes the physical table name by environment", () => {
    synthesize("TEST").hasResourceProperties("AWS::DynamoDB::GlobalTable", { TableName: "AnalyticsRollups-Test" });
    synthesize("PROD").hasResourceProperties("AWS::DynamoDB::GlobalTable", { TableName: "AnalyticsRollups-Prod" });
  });
});
