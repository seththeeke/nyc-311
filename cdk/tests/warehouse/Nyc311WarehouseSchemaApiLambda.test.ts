import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { Nyc311WarehouseBucket } from "../../warehouse/Nyc311WarehouseBucket";
import { Nyc311WarehouseCatalog } from "../../warehouse/Nyc311WarehouseCatalog";
import { Nyc311WarehouseSchemaApiLambda } from "../../warehouse/Nyc311WarehouseSchemaApiLambda";

function synthesize(envName: "TEST" | "PROD" = "TEST"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  const warehouseBucket = new Nyc311WarehouseBucket(stack, "Nyc311WarehouseBucket", { envName });
  const warehouseCatalog = new Nyc311WarehouseCatalog(stack, "Nyc311WarehouseCatalog", { envName, warehouseBucket });
  new Nyc311WarehouseSchemaApiLambda(stack, "Nyc311WarehouseSchemaApiLambda", { envName, warehouseCatalog });
  return Template.fromStack(stack);
}

function policyActions(template: Template): string[] {
  const policies = template.findResources("AWS::IAM::Policy");
  const actions = new Set<string>();
  for (const policy of Object.values(policies)) {
    const statements = (policy.Properties as { PolicyDocument: { Statement: { Action?: string | string[] }[] } })
      .PolicyDocument.Statement;
    for (const s of statements) {
      for (const a of Array.isArray(s.Action) ? s.Action : s.Action ? [s.Action] : []) actions.add(a);
    }
  }
  return [...actions];
}

describe("Nyc311WarehouseSchemaApiLambda", () => {
  it("bundles getWarehouseSchemaController on Node 22 with the database name as env", () => {
    synthesize("TEST").hasResourceProperties("AWS::Lambda::Function", {
      Handler: "index.getWarehouseSchemaController",
      Runtime: "nodejs22.x",
      FunctionName: "Nyc311WarehouseSchemaApi-Test",
      Environment: { Variables: Match.objectLike({ WAREHOUSE_DATABASE_NAME: "nyc311_warehouse_test" }) },
    });
  });

  it("grants Glue catalog reads only — no writes, no DynamoDB, no S3", () => {
    const actions = policyActions(synthesize("TEST"));
    expect(actions).toEqual(expect.arrayContaining(["glue:GetTable", "glue:GetTables"]));
    expect(actions.filter((a) => a.startsWith("glue:") && !a.startsWith("glue:Get"))).toEqual([]);
    expect(actions.filter((a) => a.startsWith("dynamodb:") || a.startsWith("s3:"))).toEqual([]);
  });

  it("suffixes the function name by environment", () => {
    synthesize("PROD").hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311WarehouseSchemaApi-Prod" });
  });
});
