import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { describe, it } from "vitest";
import { ResidentIdeasTable } from "../../customer/ResidentIdeasTable";
import { ResidentsTable } from "../../customer/ResidentsTable";

function synthesize(): Template {
  const stack = new Stack(new App(), "TestStack", { env: { region: "us-east-1" } });
  new ResidentsTable(stack, "ResidentsTable");
  new ResidentIdeasTable(stack, "ResidentIdeasTable");
  return Template.fromStack(stack);
}

const key = (name: string, type: "HASH" | "RANGE") => ({ AttributeName: name, KeyType: type });

describe("resident tables", () => {
  it("keys Residents by persona and row, with the sparse Roster index", () => {
    synthesize().hasResourceProperties("AWS::DynamoDB::GlobalTable", {
      TableName: "Residents-Prod",
      KeySchema: [key("persona_id", "HASH"), key("sk", "RANGE")],
      GlobalSecondaryIndexes: [{ IndexName: "Roster", KeySchema: [key("roster_pk", "HASH"), key("persona_id", "RANGE")], Projection: { ProjectionType: "ALL" } }],
    });
  });

  it("keys ResidentIdeas by persona and row, with the ByOrder, Feed and ByResident indexes and no TTL", () => {
    synthesize().hasResourceProperties("AWS::DynamoDB::GlobalTable", {
      TableName: "ResidentIdeas-Prod",
      KeySchema: [key("persona_id", "HASH"), key("sk", "RANGE")],
      GlobalSecondaryIndexes: [
        { IndexName: "ByOrder", KeySchema: [key("by_order_pk", "HASH"), key("idea_id", "RANGE")], Projection: { ProjectionType: "ALL" } },
        { IndexName: "Feed", KeySchema: [key("feed_pk", "HASH"), key("idea_id", "RANGE")], Projection: { ProjectionType: "ALL" } },
        { IndexName: "ByResident", KeySchema: [key("resident_pk", "HASH"), key("idea_id", "RANGE")], Projection: { ProjectionType: "ALL" } },
      ],
    });
  });

  it("retains both tables: ideas and counters are not rebuildable", () => {
    const template = synthesize();
    template.allResources("AWS::DynamoDB::GlobalTable", { DeletionPolicy: "Retain" });
  });
});
