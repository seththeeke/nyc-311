import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import { beforeAll, describe, expect, it } from "vitest";
import { FeatureFlagsTable } from "../../data/FeatureFlagsTable";
import { LocationsTable } from "../../data/LocationsTable";
import { OperatorsTable } from "../../data/OperatorsTable";
import { OrdersTable } from "../../data/OrdersTable";
import { RequestsTable } from "../../data/RequestsTable";
import { UsersTable } from "../../data/UsersTable";
import { WarehouseJobRunsTable } from "../../data/WarehouseJobRunsTable";
import { Nyc311AdminApiLambda } from "../../lambda/Nyc311AdminApiLambda";
import { Nyc311AdHocQueryWorkgroup } from "../../warehouse/Nyc311AdHocQueryWorkgroup";
import { Nyc311AnalyticsWorkgroup } from "../../warehouse/Nyc311AnalyticsWorkgroup";
import { Nyc311WarehouseBucket } from "../../warehouse/Nyc311WarehouseBucket";
import { Nyc311WarehouseCatalog } from "../../warehouse/Nyc311WarehouseCatalog";
import { Nyc311WarehouseJobRunnerLambda } from "../../warehouse/Nyc311WarehouseJobRunnerLambda";
import { Nyc311WarehouseJobScheduleGroup } from "../../warehouse/Nyc311WarehouseJobScheduleGroup";

const FAKE_STATE_MACHINE_ARN = "arn:aws:states:us-east-1:123456789012:stateMachine:Fake";

function synthesize(envName: "TEST" | "PROD"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  const jobRunsTable = new WarehouseJobRunsTable(stack, "WarehouseJobRunsTable", { envName });
  const warehouseBucket = new Nyc311WarehouseBucket(stack, "Nyc311WarehouseBucket", { envName });
  const warehouseCatalog = new Nyc311WarehouseCatalog(stack, "Nyc311WarehouseCatalog", { envName, warehouseBucket });
  const analyticsWorkgroup = new Nyc311AnalyticsWorkgroup(stack, "Nyc311AnalyticsWorkgroup", { envName, warehouseBucket });
  const jobRunnerLambda = new Nyc311WarehouseJobRunnerLambda(stack, "Nyc311WarehouseJobRunnerLambda", {
    envName,
    jobRunsTable,
    warehouseBucket,
    warehouseCatalog,
    analyticsWorkgroup,
  });
  new Nyc311AdminApiLambda(stack, "Nyc311AdminApiLambda", {
    envName,
    usersTable: new UsersTable(stack, "UsersTable", { envName }),
    operatorsTable: new OperatorsTable(stack, "OperatorsTable", { envName }),
    ordersTable: new OrdersTable(stack, "OrdersTable", { envName }),
    requestsTable: new RequestsTable(stack, "RequestsTable", { envName }),
    locationsTable: new LocationsTable(stack, "LocationsTable", { envName }),
    featureFlagsTable: new FeatureFlagsTable(stack, "FeatureFlagsTable", { envName }),
    jobRunsTable,
    warehouseBucket,
    warehouseCatalog,
    adHocQueryWorkgroup: new Nyc311AdHocQueryWorkgroup(stack, "Nyc311AdHocQueryWorkgroup", { envName, warehouseBucket }),
    jobRunnerLambda,
    jobScheduleGroup: new Nyc311WarehouseJobScheduleGroup(stack, "Nyc311WarehouseJobScheduleGroup", {
      envName,
      jobRunnerLambda,
      failureNotificationEmail: "ops@example.com",
    }),
    orderExecutionStateMachine: sfn.StateMachine.fromStateMachineArn(stack, "FakeStateMachine", FAKE_STATE_MACHINE_ARN),
  });
  return Template.fromStack(stack);
}

type Statement = { Action?: string | string[]; Resource?: unknown };

/* Only the bundle's own policy — the job runner and schedule group built as dependencies carry their own, broader grants. */
function bundleStatements(template: Template): Statement[] {
  const policies = template.findResources("AWS::IAM::Policy");
  return Object.entries(policies)
    .filter(([logicalId]) => logicalId.startsWith("Nyc311AdminApiLambda"))
    .flatMap(([, policy]) => (policy.Properties as { PolicyDocument: { Statement: Statement[] } }).PolicyDocument.Statement);
}

function actionsOf(statements: Statement[]): string[] {
  return [...new Set(statements.flatMap((s) => (Array.isArray(s.Action) ? s.Action : s.Action ? [s.Action] : [])))].sort();
}

describe("Nyc311AdminApiLambda", () => {
  let testTemplate: Template;

  beforeAll(() => {
    testTemplate = synthesize("TEST");
  });

  it("bundles the admin router on Node 22 with a 5-minute timeout", () => {
    testTemplate.hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "Nyc311AdminApi-Test",
      Handler: "index.adminApiRouter",
      Runtime: "nodejs22.x",
      Timeout: 300,
      MemorySize: 512,
    });
  });

  it("suffixes the function and log group by environment, and destroys the log group with the stack", () => {
    testTemplate.hasResource("AWS::Logs::LogGroup", {
      Properties: { LogGroupName: "/aws/lambda/Nyc311AdminApi-Test", RetentionInDays: 30 },
      DeletionPolicy: "Delete",
    });
    synthesize("PROD").hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311AdminApi-Prod" });
  });

  it("carries every env var the admin controllers' services read", () => {
    const fn = Object.values(testTemplate.findResources("AWS::Lambda::Function", { Properties: { FunctionName: "Nyc311AdminApi-Test" } }))[0];
    const variables = (fn.Properties as { Environment: { Variables: Record<string, unknown> } }).Environment.Variables;

    expect(Object.keys(variables).sort()).toEqual(
      [
        "AD_HOC_ATHENA_WORKGROUP",
        "FEATURE_FLAGS_TABLE_NAME",
        "JOB_RESULTS_BUCKET",
        "LOCATIONS_TABLE_NAME",
        "OPERATORS_TABLE_NAME",
        "ORDERS_TABLE_NAME",
        "ORDER_EXECUTION_STATE_MACHINE_ARN",
        "REQUESTS_TABLE_NAME",
        "SCHEDULER_GROUP_NAME",
        "SCHEDULER_ROLE_ARN",
        "USERS_TABLE_NAME",
        "WAREHOUSE_DATABASE_NAME",
        "WAREHOUSE_JOB_DLQ_ARN",
        "WAREHOUSE_JOB_ENV_SUFFIX",
        "WAREHOUSE_JOB_RUNNER_FUNCTION_ARN",
        "WAREHOUSE_JOB_RUNS_TABLE_NAME",
      ].sort()
    );
  });

  it("grants exactly the union of the retired per-route admin Lambdas' actions — no Scan, no writes to Requests/Locations", () => {
    expect(actionsOf(bundleStatements(testTemplate))).toEqual(
      [
        "athena:GetQueryExecution",
        "athena:GetQueryResults",
        "athena:StartQueryExecution",
        "dynamodb:DeleteItem",
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:Query",
        "glue:GetDatabase",
        "glue:GetPartition",
        "glue:GetPartitions",
        "glue:GetTable",
        "glue:GetTables",
        "iam:PassRole",
        "s3:DeleteObject",
        "s3:GetBucketLocation",
        "s3:GetObject",
        "s3:ListBucket",
        "s3:PutObject",
        "scheduler:CreateSchedule",
        "scheduler:DeleteSchedule",
        "scheduler:UpdateSchedule",
        "states:StartExecution",
      ].sort()
    );
  });

  it("scopes iam:PassRole to the schedule group's one invocation role", () => {
    const passRole = bundleStatements(testTemplate).filter((s) => s.Action === "iam:PassRole");

    expect(passRole).toHaveLength(1);
    expect(passRole[0].Resource).toEqual({
      "Fn::GetAtt": [expect.stringMatching(/^Nyc311WarehouseJobScheduleGroupInvocationRole/), "Arn"],
    });
  });

  it("scopes S3 writes to the ad-hoc results and job-definitions prefixes only", () => {
    const writes = bundleStatements(testTemplate).filter(
      (s) => Array.isArray(s.Action) && s.Action.includes("s3:PutObject")
    );

    expect(writes).toHaveLength(1);
    expect(JSON.stringify(writes[0].Resource)).toMatch(/athena-results\/adhoc\/\*/);
    expect(JSON.stringify(writes[0].Resource)).toMatch(/job-definitions\/\*/);
    expect(JSON.stringify(writes[0].Resource)).not.toMatch(/"\/\*"|job-results/);
  });

  it("only reads the Requests and Locations tables", () => {
    testTemplate.hasResourceProperties("AWS::IAM::Policy", {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: "dynamodb:GetItem",
            Resource: Match.arrayWith([{ "Fn::GetAtt": [Match.stringLikeRegexp("^RequestsTable"), "Arn"] }]),
          }),
        ]),
      }),
    });
  });
});
