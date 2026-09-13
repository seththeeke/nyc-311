import * as path from "node:path";
import { Duration } from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";
import type { WarehouseJobRunsTable } from "../data/WarehouseJobRunsTable";
import type { UsersTable } from "../data/UsersTable";
import type { Nyc311WarehouseBucket } from "./Nyc311WarehouseBucket";
import type { Nyc311WarehouseJobRunnerLambda } from "./Nyc311WarehouseJobRunnerLambda";
import type { Nyc311WarehouseJobScheduleGroup } from "./Nyc311WarehouseJobScheduleGroup";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311ListWarehouseJobsApiLambdaProps {
  envName: Nyc311Environment;
  jobRunsTable: WarehouseJobRunsTable;
  usersTable: UsersTable;
  warehouseBucket: Nyc311WarehouseBucket;
  jobRunnerLambda: Nyc311WarehouseJobRunnerLambda;
  jobScheduleGroup: Nyc311WarehouseJobScheduleGroup;
}

/**
 * Backs admin-authorized `GET /admin/warehouse/jobs`
 * (`7-data-warehousing.md` §12b, Leg 8) — entry point is
 * `backend/controller/web-api/listWarehouseJobsController.ts`. Read-only
 * at the IAM layer, not just by convention: no `s3:*`, no
 * `scheduler:*`, no `iam:PassRole` — only `dynamodb:Query` on
 * `WarehouseJobRuns`.
 */
export class Nyc311ListWarehouseJobsApiLambda extends NodejsFunction {
  constructor(scope: Construct, id: string, props: Nyc311ListWarehouseJobsApiLambdaProps) {
    const functionName = `Nyc311ListWarehouseJobsApi-${ENV_NAME_SUFFIX[props.envName]}`;

    const logGroup = new logs.LogGroup(scope, `${id}LogGroup`, {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: logs.RetentionDays.ONE_MONTH,
    });

    const backendRoot = path.join(__dirname, "..", "..", "backend");

    super(scope, id, {
      functionName,
      entry: path.join(backendRoot, "controller", "web-api", "listWarehouseJobsController.ts"),
      handler: "listWarehouseJobsController",
      runtime: Runtime.NODEJS_22_X,
      timeout: Duration.seconds(10),
      memorySize: 256,
      logGroup,
      projectRoot: backendRoot,
      depsLockFilePath: path.join(backendRoot, "package-lock.json"),
      environment: {
        WAREHOUSE_JOB_RUNS_TABLE_NAME: props.jobRunsTable.tableName,
        USERS_TABLE_NAME: props.usersTable.tableName,
        /*
         * warehouseJobDefinitionService's shared resolve() eagerly
         * builds every field regardless of which exported function is
         * calling it — none of these four are used by listWarehouseJobs
         * itself, but still required to be present. The real
         * least-privilege boundary is IAM (below), not which env vars
         * exist.
         */
        JOB_RESULTS_BUCKET: props.warehouseBucket.bucketName,
        SCHEDULER_GROUP_NAME: props.jobScheduleGroup.scheduleGroupName,
        SCHEDULER_ROLE_ARN: props.jobScheduleGroup.invocationRole.roleArn,
        WAREHOUSE_JOB_RUNNER_FUNCTION_ARN: props.jobRunnerLambda.functionArn,
        WAREHOUSE_JOB_DLQ_ARN: props.jobScheduleGroup.deadLetterQueue.queueArn,
        WAREHOUSE_JOB_ENV_SUFFIX: ENV_NAME_SUFFIX[props.envName],
      },
    });

    props.jobRunsTable.grant(this, "dynamodb:Query");
    props.usersTable.grant(this, "dynamodb:Query", "dynamodb:PutItem");
  }
}
