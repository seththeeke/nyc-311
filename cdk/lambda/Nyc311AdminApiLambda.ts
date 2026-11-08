import * as path from "node:path";
import { Duration, RemovalPolicy, Stack } from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { NYC311_LAMBDA_BUNDLING } from "./lambdaBundling";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";
import type { ContactsTable } from "../data/ContactsTable";
import type { FeatureFlagsTable } from "../data/FeatureFlagsTable";
import type { LiveWorkspaceMetricsTable } from "../data/LiveWorkspaceMetricsTable";
import type { OperatorsTable } from "../data/OperatorsTable";
import type { OrdersTable } from "../data/OrdersTable";
import type { UsersTable } from "../data/UsersTable";
import type { WarehouseJobRunsTable } from "../data/WarehouseJobRunsTable";
import type { Nyc311AdHocQueryWorkgroup } from "../warehouse/Nyc311AdHocQueryWorkgroup";
import type { Nyc311WarehouseBucket } from "../warehouse/Nyc311WarehouseBucket";
import type { Nyc311WarehouseCatalog } from "../warehouse/Nyc311WarehouseCatalog";
import type { Nyc311WarehouseJobRunnerLambda } from "../warehouse/Nyc311WarehouseJobRunnerLambda";
import type { Nyc311WarehouseJobScheduleGroup } from "../warehouse/Nyc311WarehouseJobScheduleGroup";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311AdminApiLambdaProps {
  envName: Nyc311Environment;
  usersTable: UsersTable;
  operatorsTable: OperatorsTable;
  ordersTable: OrdersTable;
  featureFlagsTable: FeatureFlagsTable;
  /** Read by GET /capacity/snapshot (docs/17-executive-team.md §12.3). */
  liveWorkspaceMetricsTable: LiveWorkspaceMetricsTable;
  jobRunsTable: WarehouseJobRunsTable;
  /* The CPO's contact updates (17-executive-team.md §17.3). */
  contactsTable: ContactsTable;
  warehouseBucket: Nyc311WarehouseBucket;
  warehouseCatalog: Nyc311WarehouseCatalog;
  adHocQueryWorkgroup: Nyc311AdHocQueryWorkgroup;
  jobRunnerLambda: Nyc311WarehouseJobRunnerLambda;
  jobScheduleGroup: Nyc311WarehouseJobScheduleGroup;
}

/**
 * The admin Service API bundle (`15-resource-consolidation.md` §3.2) — one
 * Lambda for every JWT-authorized route, entry
 * `backend/controller/web-api/admin/adminApiRouter.ts`. Its env and IAM are
 * the union of the per-route Lambdas it replaces, each grant still scoped
 * to its own table/prefix/ARN; nothing is broader than some route needed.
 */
export class Nyc311AdminApiLambda extends NodejsFunction {
  constructor(scope: Construct, id: string, props: Nyc311AdminApiLambdaProps) {
    const suffix = ENV_NAME_SUFFIX[props.envName];
    const functionName = `Nyc311AdminApi-${suffix}`;

    const logGroup = new logs.LogGroup(scope, `${id}LogGroup`, {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const backendRoot = path.join(__dirname, "..", "..", "backend");

    super(scope, id, {
      functionName,
      entry: path.join(backendRoot, "controller", "web-api", "admin", "adminApiRouter.ts"),
      handler: "adminApiRouter",
      runtime: Runtime.NODEJS_22_X,
      bundling: NYC311_LAMBDA_BUNDLING,
      /* API Gateway answers at 30s; the ad-hoc query's own poll gives up at 20s. */
      timeout: Duration.seconds(30),
      memorySize: 512,
      logGroup,
      projectRoot: backendRoot,
      depsLockFilePath: path.join(backendRoot, "package-lock.json"),
      environment: {
        USERS_TABLE_NAME: props.usersTable.tableName,
        OPERATORS_TABLE_NAME: props.operatorsTable.tableName,
        ORDERS_TABLE_NAME: props.ordersTable.tableName,
        FEATURE_FLAGS_TABLE_NAME: props.featureFlagsTable.tableName,
        LIVE_WORKSPACE_METRICS_TABLE_NAME: props.liveWorkspaceMetricsTable.tableName,
        AD_HOC_ATHENA_WORKGROUP: props.adHocQueryWorkgroup.workgroupName,
        WAREHOUSE_DATABASE_NAME: props.warehouseCatalog.databaseName,
        WAREHOUSE_JOB_RUNS_TABLE_NAME: props.jobRunsTable.tableName,
        CONTACTS_TABLE_NAME: props.contactsTable.tableName,
        JOB_RESULTS_BUCKET: props.warehouseBucket.bucketName,
        SCHEDULER_GROUP_NAME: props.jobScheduleGroup.scheduleGroupName,
        SCHEDULER_ROLE_ARN: props.jobScheduleGroup.invocationRole.roleArn,
        WAREHOUSE_JOB_RUNNER_FUNCTION_ARN: props.jobRunnerLambda.functionArn,
        WAREHOUSE_JOB_DLQ_ARN: props.jobScheduleGroup.deadLetterQueue.queueArn,
        WAREHOUSE_JOB_ENV_SUFFIX: suffix,
      },
    });

    /* requireAdminUser (every route); capacity CRUD and snapshot; flag writes; job definitions. */
    props.usersTable.grant(this, "dynamodb:Query", "dynamodb:PutItem");
    props.operatorsTable.grant(this, "dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:Query");
    props.ordersTable.grant(this, "dynamodb:Query");
    props.liveWorkspaceMetricsTable.grant(this, "dynamodb:BatchGetItem");
    props.featureFlagsTable.grant(this, "dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:DeleteItem");
    props.jobRunsTable.grant(this, "dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:DeleteItem", "dynamodb:Query");
    props.contactsTable.grant(this, "dynamodb:GetItem", "dynamodb:PutItem");

    const stack = Stack.of(this);
    const bucketArn = props.warehouseBucket.bucket.bucketArn;

    /* Ad-hoc query: its own workgroup, read-only Glue, warehouse data reads, results under athena-results/adhoc/ only. */
    this.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["athena:StartQueryExecution", "athena:GetQueryExecution", "athena:GetQueryResults"],
        resources: [stack.formatArn({ service: "athena", resource: "workgroup", resourceName: props.adHocQueryWorkgroup.workgroupName })],
      })
    );
    this.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["glue:GetDatabase", "glue:GetTable", "glue:GetTables", "glue:GetPartition", "glue:GetPartitions"],
        resources: [
          stack.formatArn({ service: "glue", resource: "catalog" }),
          stack.formatArn({ service: "glue", resource: "database", resourceName: props.warehouseCatalog.databaseName }),
          stack.formatArn({ service: "glue", resource: "table", resourceName: `${props.warehouseCatalog.databaseName}/*` }),
        ],
      })
    );
    this.addToRolePolicy(new iam.PolicyStatement({ actions: ["s3:GetBucketLocation", "s3:ListBucket"], resources: [bucketArn] }));
    this.addToRolePolicy(
      new iam.PolicyStatement({ actions: ["s3:GetObject"], resources: [`${bucketArn}/data/*`, `${bucketArn}/job-results/*`] })
    );
    this.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
        resources: [`${bucketArn}/athena-results/adhoc/*`, `${bucketArn}/job-definitions/*`],
      })
    );

    /* Job CRUD manages the job runner's schedules; PassRole stays scoped to exactly the one invocation role. */
    this.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["scheduler:CreateSchedule", "scheduler:UpdateSchedule", "scheduler:DeleteSchedule"],
        resources: [
          stack.formatArn({ service: "scheduler", resource: "schedule", resourceName: `${props.jobScheduleGroup.scheduleGroupName}/*` }),
        ],
      })
    );
    this.addToRolePolicy(
      new iam.PolicyStatement({ actions: ["iam:PassRole"], resources: [props.jobScheduleGroup.invocationRole.roleArn] })
    );
  }
}
