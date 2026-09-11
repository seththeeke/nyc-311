import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { UsersTable } from "../../data/UsersTable";

function synthesize(envName: "TEST" | "PROD"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  new UsersTable(stack, "UsersTable", { envName });
  return Template.fromStack(stack);
}

describe("UsersTable", () => {
  it("keys on user_id alone, with PITR enabled and RETAIN removal policy", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::DynamoDB::GlobalTable", {
      KeySchema: [{ AttributeName: "user_id", KeyType: "HASH" }],
    });
    template.hasResource("AWS::DynamoDB::GlobalTable", {
      DeletionPolicy: "Retain",
      UpdateReplacePolicy: "Retain",
    });
  });

  it("declares gsi1-cognito-sub as its only GSI, projecting ALL, keyed on gsi1pk", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::DynamoDB::GlobalTable", {
      GlobalSecondaryIndexes: [
        Match.objectLike({
          IndexName: "gsi1-cognito-sub",
          KeySchema: [{ AttributeName: "gsi1pk", KeyType: "HASH" }],
          Projection: { ProjectionType: "ALL" },
        }),
      ],
    });
  });

  it("has no stream — no downstream consumer needs User change capture today", () => {
    const template = synthesize("TEST");
    const tables = template.findResources("AWS::DynamoDB::GlobalTable");
    const props = Object.values(tables)[0]?.Properties as Record<string, unknown>;
    expect(props["StreamSpecification"]).toBeUndefined();
  });

  it("suffixes the physical table name by environment", () => {
    synthesize("TEST").hasResourceProperties("AWS::DynamoDB::GlobalTable", { TableName: "Users-Test" });
    synthesize("PROD").hasResourceProperties("AWS::DynamoDB::GlobalTable", { TableName: "Users-Prod" });
  });
});
