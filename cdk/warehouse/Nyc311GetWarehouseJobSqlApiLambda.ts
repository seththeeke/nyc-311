import * as path from "node:path";
import { Duration } from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";
import type { WarehouseJobRunsTable } from "../data/WarehouseJobRunsTable";
import type { UsersTable } from "../data/UsersTable";
import type { Nyc311WarehouseBucket } from "./Nyc311WarehouseBucket";
import type { Nyc311WarehouseJobRunnerLambda } from "./Nyc311WarehouseJobRunnerLambda";
import type { Nyc311WarehouseJobScheduleGroup } from "./Nyc311WarehouseJobScheduleGroup";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311GetWarehouseJobSqlApiLambdaProps {
  envName: Nyc311Environment;
  jobRunsTable: WarehouseJobRunsTable;
  usersTable: UsersTable;
  warehouseBucket: Nyc311WarehouseBucket;
  jobRunnerLambda: Nyc311WarehouseJobRunnerLambda;
  jobScheduleGroup: Nyc311WarehouseJobScheduleGroup;
}

/**
 * Backs admin-authorized `GET /admin/warehouse/jobs/{name}/sql`
 * (`7-data-warehousing.md` §12b's "load a job into the query editor"
 * flow) — entry point is `backend/controller/web-api/
 * getWarehouseJobSqlController.ts`. Read-only: `dynamodb:GetItem` on the
 * definition row plus `s3:GetObject` scoped to `job-definitions/*`,
 * nothing broader — this Lambda never writes and never touches a
 * schedule.
 */
export class Nyc311GetWarehouseJobSqlApiLambda extends NodejsFunction {
  constructor(scope: Construct, id: string, props: Nyc311GetWarehouseJobSqlApiLambdaProps) {
    const functionName = `Nyc311GetWarehouseJobSqlApi-${ENV_NAME_SUFFIX[props.envName]}`;

    const logGroup = new logs.LogGroup(scope, `${id}LogGroup`, {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: logs.RetentionDays.ONE_MONTH,
    });

    const backendRoot = path.join(__dirname, "..", "..", "backend");

    super(scope, id, {
      functionName,
      entry: path.join(backendRoot, "controller", "web-api", "getWarehouseJobSqlController.ts"),
      handler: "getWarehouseJobSqlController",
      runtime: Runtime.NODEJS_22_X,
      timeout: Duration.seconds(10),
      memorySize: 256,
      logGroup,
      projectRoot: backendRoot,
      depsLockFilePath: path.join(backendRoot, "package-lock.json"),
      environment: {
        WAREHOUSE_JOB_RUNS_TABLE_NAME: props.jobRunsTable.tableName,
        USERS_TABLE_NAME: props.usersTable.tableName,
        JOB_RESULTS_BUCKET: props.warehouseBucket.bucketName,
        SCHEDULER_GROUP_NAME: props.jobScheduleGroup.scheduleGroupName,
        /*
         * warehouseJobDefinitionService's shared resolve() eagerly builds
         * every field regardless of which exported function is calling
         * it — these are unused by getWarehouseJobSql itself, but still
         * required to be present. The real least-privilege boundary is
         * IAM (below), not which env vars exist.
         */
        SCHEDULER_ROLE_ARN: props.jobScheduleGroup.invocationRole.roleArn,
        WAREHOUSE_JOB_RUNNER_FUNCTION_ARN: props.jobRunnerLambda.functionArn,
        WAREHOUSE_JOB_DLQ_ARN: props.jobScheduleGroup.deadLetterQueue.queueArn,
        WAREHOUSE_JOB_ENV_SUFFIX: ENV_NAME_SUFFIX[props.envName],
      },
    });

    props.jobRunsTable.grant(this, "dynamodb:GetItem");
    props.usersTable.grant(this, "dynamodb:Query", "dynamodb:PutItem");

    this.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["s3:GetObject"],
        resources: [`${props.warehouseBucket.bucket.bucketArn}/job-definitions/*`],
      })
    );
  }
}
