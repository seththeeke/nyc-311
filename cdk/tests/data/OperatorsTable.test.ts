import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { OperatorsTable } from "../../data/OperatorsTable";

function synthesize(envName: "TEST" | "PROD"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  new OperatorsTable(stack, "OperatorsTable", { envName });
  return Template.fromStack(stack);
}

describe("OperatorsTable", () => {
  it("keys on operator_id + sk, with PITR enabled and RETAIN removal policy", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::DynamoDB::GlobalTable", {
      KeySchema: [
        { AttributeName: "operator_id", KeyType: "HASH" },
        { AttributeName: "sk", KeyType: "RANGE" },
      ],
      Replicas: Match.arrayWith([
        Match.objectLike({ PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true } }),
      ]),
    });
    template.hasResource("AWS::DynamoDB::GlobalTable", {
      DeletionPolicy: "Retain",
      UpdateReplacePolicy: "Retain",
    });
  });

  it("has no stream — the all-time cost warehouse job is future work, not built in this leg", () => {
    const template = synthesize("TEST");
    const tables = template.findResources("AWS::DynamoDB::GlobalTable");
    const props = Object.values(tables)[0]?.Properties as Record<string, unknown>;
    expect(props["StreamSpecification"]).toBeUndefined();
  });

  it("declares gsi1-availability and gsi2-roster as GSIs projecting ALL", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::DynamoDB::GlobalTable", {
      GlobalSecondaryIndexes: [
        Match.objectLike({
          IndexName: "gsi1-availability",
          KeySchema: [
            { AttributeName: "gsi1pk", KeyType: "HASH" },
            { AttributeName: "gsi1sk", KeyType: "RANGE" },
          ],
          Projection: { ProjectionType: "ALL" },
        }),
        Match.objectLike({
          IndexName: "gsi2-roster",
          KeySchema: [
            { AttributeName: "gsi2pk", KeyType: "HASH" },
            { AttributeName: "gsi2sk", KeyType: "RANGE" },
          ],
          Projection: { ProjectionType: "ALL" },
        }),
      ],
    });
  });

  it("suffixes the physical table name by environment", () => {
    synthesize("TEST").hasResourceProperties("AWS::DynamoDB::GlobalTable", { TableName: "Operators-Test" });
    synthesize("PROD").hasResourceProperties("AWS::DynamoDB::GlobalTable", { TableName: "Operators-Prod" });
  });
});
