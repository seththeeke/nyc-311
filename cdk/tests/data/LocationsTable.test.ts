import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { LocationsTable } from "../../data/LocationsTable";

function synthesize(envName: "TEST" | "PROD"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  new LocationsTable(stack, "LocationsTable", { envName });
  return Template.fromStack(stack);
}

describe("LocationsTable", () => {
  it("keys on location_id alone, with PITR enabled and RETAIN removal policy, no GSIs", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::DynamoDB::GlobalTable", {
      KeySchema: [{ AttributeName: "location_id", KeyType: "HASH" }],
    });
    template.hasResource("AWS::DynamoDB::GlobalTable", {
      DeletionPolicy: "Retain",
      UpdateReplacePolicy: "Retain",
    });
    const tables = template.findResources("AWS::DynamoDB::GlobalTable");
    const props = Object.values(tables)[0]?.Properties as Record<string, unknown>;
    expect(props["GlobalSecondaryIndexes"]).toBeUndefined();
  });

  it("suffixes the physical table name by environment", () => {
    synthesize("TEST").hasResourceProperties("AWS::DynamoDB::GlobalTable", { TableName: "Locations-Test" });
    synthesize("PROD").hasResourceProperties("AWS::DynamoDB::GlobalTable", { TableName: "Locations-Prod" });
  });
});
