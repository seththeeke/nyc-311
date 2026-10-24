import * as path from "node:path";
import { Duration, RemovalPolicy, Stack } from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { NYC311_LAMBDA_BUNDLING } from "./lambdaBundling";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import type { IStateMachine } from "aws-cdk-lib/aws-stepfunctions";
import type { Construct } from "constructs";
import type { FeatureFlagsTable } from "../data/FeatureFlagsTable";
import type { LocationsTable } from "../data/LocationsTable";
import type { OperatorsTable } from "../data/OperatorsTable";
import type { OrdersTable } from "../data/OrdersTable";
import type { RequestsTable } from "../data/RequestsTable";
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
  requestsTable: RequestsTable;
  locationsTable: LocationsTable;
  featureFlagsTable: FeatureFlagsTable;
  jobRunsTable: WarehouseJobRunsTable;
  warehouseBucket: Nyc311WarehouseBucket;
  warehouseCatalog: Nyc311WarehouseCatalog;
  adHocQueryWorkgroup: Nyc311AdHocQueryWorkgroup;
  jobRunnerLambda: Nyc311WarehouseJobRunnerLambda;
  jobScheduleGroup: Nyc311WarehouseJobScheduleGroup;
  orderExecutionStateMachine: IStateMachine;
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
      /*
       * POST /scheduling/run's 5 minutes, kept: API Gateway answers at 30s,
       * but the scheduling pass it started still runs to completion, as it
       * did in its own Lambda. Every other route finishes well inside 30s.
       */
      timeout: Duration.minutes(5),
      memorySize: 512,
      logGroup,
      projectRoot: backendRoot,
      depsLockFilePath: path.join(backendRoot, "package-lock.json"),
      environment: {
        USERS_TABLE_NAME: props.usersTable.tableName,
        OPERATORS_TABLE_NAME: props.operatorsTable.tableName,
        ORDERS_TABLE_NAME: props.ordersTable.tableName,
        REQUESTS_TABLE_NAME: props.requestsTable.tableName,
        LOCATIONS_TABLE_NAME: props.locationsTable.tableName,
        ORDER_EXECUTION_STATE_MACHINE_ARN: props.orderExecutionStateMachine.stateMachineArn,
        FEATURE_FLAGS_TABLE_NAME: props.featureFlagsTable.tableName,
        AD_HOC_ATHENA_WORKGROUP: props.adHocQueryWorkgroup.workgroupName,
        WAREHOUSE_DATABASE_NAME: props.warehouseCatalog.databaseName,
        WAREHOUSE_JOB_RUNS_TABLE_NAME: props.jobRunsTable.tableName,
        JOB_RESULTS_BUCKET: props.warehouseBucket.bucketName,
        SCHEDULER_GROUP_NAME: props.jobScheduleGroup.scheduleGroupName,
        SCHEDULER_ROLE_ARN: props.jobScheduleGroup.invocationRole.roleArn,
        WAREHOUSE_JOB_RUNNER_FUNCTION_ARN: props.jobRunnerLambda.functionArn,
        WAREHOUSE_JOB_DLQ_ARN: props.jobScheduleGroup.deadLetterQueue.queueArn,
        WAREHOUSE_JOB_ENV_SUFFIX: suffix,
      },
    });

    /* requireAdminUser (every route); capacity CRUD + scheduling; flag writes; job definitions. */
    props.usersTable.grant(this, "dynamodb:Query", "dynamodb:PutItem");
    props.operatorsTable.grant(this, "dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:Query");
    props.ordersTable.grant(this, "dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:Query");
    props.requestsTable.grant(this, "dynamodb:GetItem");
    props.locationsTable.grant(this, "dynamodb:GetItem");
    props.featureFlagsTable.grant(this, "dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:DeleteItem");
    props.jobRunsTable.grant(this, "dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:DeleteItem", "dynamodb:Query");
    props.orderExecutionStateMachine.grantStartExecution(this);

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
