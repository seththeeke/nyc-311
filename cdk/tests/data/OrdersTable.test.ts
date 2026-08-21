import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, it } from "vitest";
import { OrdersTable } from "../../data/OrdersTable";

function synthesize(envName: "TEST" | "PROD"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  new OrdersTable(stack, "OrdersTable", { envName });
  return Template.fromStack(stack);
}

describe("OrdersTable", () => {
  it("keys on order_id + sk, with PITR enabled and RETAIN removal policy", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::DynamoDB::GlobalTable", {
      KeySchema: [
        { AttributeName: "order_id", KeyType: "HASH" },
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

  it("streams NEW_AND_OLD_IMAGES", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::DynamoDB::GlobalTable", {
      StreamSpecification: { StreamViewType: "NEW_AND_OLD_IMAGES" },
    });
  });

  it("declares gsi1-stage-sla and gsi2-assigned-operator as GSIs projecting ALL", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::DynamoDB::GlobalTable", {
      GlobalSecondaryIndexes: [
        Match.objectLike({
          IndexName: "gsi1-stage-sla",
          KeySchema: [
            { AttributeName: "gsi1pk", KeyType: "HASH" },
            { AttributeName: "gsi1sk", KeyType: "RANGE" },
          ],
          Projection: { ProjectionType: "ALL" },
        }),
        Match.objectLike({
          IndexName: "gsi2-assigned-operator",
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
    synthesize("TEST").hasResourceProperties("AWS::DynamoDB::GlobalTable", { TableName: "Orders-Test" });
    synthesize("PROD").hasResourceProperties("AWS::DynamoDB::GlobalTable", { TableName: "Orders-Prod" });
  });
});
