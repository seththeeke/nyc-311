import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { UsersTable } from "../../data/UsersTable";
import { Nyc311WarehouseBucket } from "../../warehouse/Nyc311WarehouseBucket";
import { Nyc311WarehouseCatalog } from "../../warehouse/Nyc311WarehouseCatalog";
import { Nyc311AdHocQueryWorkgroup } from "../../warehouse/Nyc311AdHocQueryWorkgroup";
import { Nyc311AdHocQueryApiLambda } from "../../warehouse/Nyc311AdHocQueryApiLambda";

function synthesize(envName: "TEST" | "PROD" = "TEST"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  const usersTable = new UsersTable(stack, "UsersTable", { envName });
  const warehouseBucket = new Nyc311WarehouseBucket(stack, "Nyc311WarehouseBucket", { envName });
  const warehouseCatalog = new Nyc311WarehouseCatalog(stack, "Nyc311WarehouseCatalog", { envName, warehouseBucket });
  const adHocQueryWorkgroup = new Nyc311AdHocQueryWorkgroup(stack, "Nyc311AdHocQueryWorkgroup", {
    envName,
    warehouseBucket,
  });
  new Nyc311AdHocQueryApiLambda(stack, "Nyc311AdHocQueryApiLambda", {
    envName,
    warehouseBucket,
    warehouseCatalog,
    adHocQueryWorkgroup,
    usersTable,
  });
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

describe("Nyc311AdHocQueryApiLambda", () => {
  it("bundles runAdHocQueryController on Node 22 with the ad-hoc workgroup/database as env", () => {
    synthesize("TEST").hasResourceProperties("AWS::Lambda::Function", {
      Handler: "index.runAdHocQueryController",
      Runtime: "nodejs22.x",
      FunctionName: "Nyc311AdHocQueryApi-Test",
      Timeout: 25,
      Environment: {
        Variables: Match.objectLike({
          AD_HOC_ATHENA_WORKGROUP: "Nyc311AdHocQueries-Test",
          WAREHOUSE_DATABASE_NAME: "nyc311_warehouse_test",
          USERS_TABLE_NAME: { Ref: Match.stringLikeRegexp("^UsersTable") },
        }),
      },
    });
  });

  it("suffixes the function name and log group by environment, and sets the log group to DESTROY", () => {
    synthesize("PROD").hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311AdHocQueryApi-Prod" });

    const template = synthesize("TEST");
    template.hasResource("AWS::Logs::LogGroup", {
      Properties: Match.objectLike({ LogGroupName: "/aws/lambda/Nyc311AdHocQueryApi-Test" }),
      DeletionPolicy: "Delete",
    });
  });

  it("grants Athena start/poll/results only — no StopQueryExecution, scoped to the ad-hoc workgroup only", () => {
    const template = synthesize("TEST");
    const athena = policyActions(template)
      .filter((a) => a.startsWith("athena:"))
      .sort();
    expect(athena).toEqual(["athena:GetQueryExecution", "athena:GetQueryResults", "athena:StartQueryExecution"]);

    const json = JSON.stringify(template.toJSON());
    expect(json).toContain("Nyc311AdHocQueries-Test");
    /* the job runner's own workgroup ARN never appears on this Lambda's role */
    expect(json).not.toContain("Nyc311Analytics-Test");
  });

  it("grants Glue catalog reads only — no CreateTable/UpdateTable/DeleteTable", () => {
    const actions = policyActions(synthesize("TEST"));
    expect(actions).toEqual(expect.arrayContaining(["glue:GetTable", "glue:GetTables", "glue:GetPartitions"]));
    expect(actions.filter((a) => a.startsWith("glue:") && !a.startsWith("glue:Get"))).toEqual([]);
  });

  it("its DynamoDB grants are Query/PutItem on UsersTable only — no Delete/UpdateItem, no operational-table access", () => {
    const ddb = policyActions(synthesize("TEST")).filter((a) => a.startsWith("dynamodb:"));
    expect(ddb.sort()).toEqual(["dynamodb:PutItem", "dynamodb:Query"]);
  });

  it("its S3 grants are read on data/* and read+write+delete scoped to athena-results/adhoc/* only", () => {
    const template = synthesize("TEST");
    const s3 = policyActions(template)
      .filter((a) => a.startsWith("s3:"))
      .sort();
    expect(s3).toEqual(["s3:DeleteObject", "s3:GetBucketLocation", "s3:GetObject", "s3:ListBucket", "s3:PutObject"]);

    const json = JSON.stringify(template.toJSON());
    expect(json).toContain("athena-results/adhoc/*");
    /* never grants against job-results/* (the job runner's own output) or the bare athena-results/ root */
    expect(json).not.toContain("job-results/*");
  });
});
