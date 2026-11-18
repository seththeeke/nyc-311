import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { RequestsTable } from "../../data/RequestsTable";

function synthesize(envName: "TEST" | "PROD"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  new RequestsTable(stack, "RequestsTable", { envName });
  return Template.fromStack(stack);
}

describe("RequestsTable", () => {
  it("keys on request_id with RETAIN removal policy", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::DynamoDB::GlobalTable", {
      KeySchema: [{ AttributeName: "request_id", KeyType: "HASH" }],
    });
    template.hasResource("AWS::DynamoDB::GlobalTable", {
      DeletionPolicy: "Retain",
      UpdateReplacePolicy: "Retain",
    });
  });

  it("streams NEW_AND_OLD_IMAGES, backing the order-ingestion fan-out Lambda's listener (3-order-ingestion.md §2.1)", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::DynamoDB::GlobalTable", {
      StreamSpecification: { StreamViewType: "NEW_AND_OLD_IMAGES" },
    });
  });

  it("suffixes the physical table name by environment to avoid a Test/Prod collision in the same account", () => {
    synthesize("TEST").hasResourceProperties("AWS::DynamoDB::GlobalTable", { TableName: "Requests-Test" });
    synthesize("PROD").hasResourceProperties("AWS::DynamoDB::GlobalTable", { TableName: "Requests-Prod" });
  });

  it("declares gsi1-external-key and gsi4-poller-metrics as GSIs projecting ALL", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::DynamoDB::GlobalTable", {
      GlobalSecondaryIndexes: [
        Match.objectLike({
          IndexName: "gsi1-external-key",
          KeySchema: [{ AttributeName: "gsi1pk", KeyType: "HASH" }],
          Projection: { ProjectionType: "ALL" },
        }),
        Match.objectLike({
          IndexName: "gsi4-poller-metrics",
          KeySchema: [
            { AttributeName: "gsi4pk", KeyType: "HASH" },
            { AttributeName: "gsi4sk", KeyType: "RANGE" },
          ],
          Projection: { ProjectionType: "ALL" },
        }),
      ],
    });
  });

  it("no longer declares gsi2-status or gsi3-location (#182/#232 — unused, removed)", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::DynamoDB::GlobalTable", {
      GlobalSecondaryIndexes: Match.not(
        Match.arrayWith([Match.objectLike({ IndexName: "gsi2-status" })]),
      ),
    });
    template.hasResourceProperties("AWS::DynamoDB::GlobalTable", {
      GlobalSecondaryIndexes: Match.not(
        Match.arrayWith([Match.objectLike({ IndexName: "gsi3-location" })]),
      ),
    });
  });

  it("declares exactly 2 GSIs, so this deploy deletes one GSI from the 3 deployed (#186)", () => {
    const tables = synthesize("TEST").findResources("AWS::DynamoDB::GlobalTable");
    const [table] = Object.values(tables);

    expect(table?.Properties.GlobalSecondaryIndexes).toHaveLength(2);
  });
});

describe("deletion protection (v1-prod-deployment.md B9)", () => {
  it("is enabled in Prod and off in Test", () => {
    synthesize("PROD").hasResourceProperties("AWS::DynamoDB::GlobalTable", {
      Replicas: Match.arrayWith([Match.objectLike({ DeletionProtectionEnabled: true })]),
    });
    synthesize("TEST").hasResourceProperties("AWS::DynamoDB::GlobalTable", {
      Replicas: Match.arrayWith([Match.objectLike({ DeletionProtectionEnabled: false })]),
    });
  });
});

describe("point-in-time recovery (#242 — Test's PITR storage is waste on disposable data)", () => {
  it("is enabled in Prod and off in Test", () => {
    synthesize("PROD").hasResourceProperties("AWS::DynamoDB::GlobalTable", {
      Replicas: Match.arrayWith([Match.objectLike({ PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true } })]),
    });
    synthesize("TEST").hasResourceProperties("AWS::DynamoDB::GlobalTable", {
      Replicas: Match.arrayWith([Match.objectLike({ PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: false } })]),
    });
  });
});
