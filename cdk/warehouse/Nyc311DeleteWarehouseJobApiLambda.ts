import * as path from "node:path";
import { Duration, Stack } from "aws-cdk-lib";
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

export interface Nyc311DeleteWarehouseJobApiLambdaProps {
  envName: Nyc311Environment;
  jobRunsTable: WarehouseJobRunsTable;
  usersTable: UsersTable;
  warehouseBucket: Nyc311WarehouseBucket;
  jobRunnerLambda: Nyc311WarehouseJobRunnerLambda;
  jobScheduleGroup: Nyc311WarehouseJobScheduleGroup;
}

/**
 * Backs admin-authorized `DELETE /admin/warehouse/jobs/{name}`
 * (`7-data-warehousing.md` §12b, Leg 8) — entry point is
 * `backend/controller/web-api/deleteWarehouseJobController.ts`. No
 * `iam:PassRole` at all — deleting a schedule never needs it. Every past
 * `WarehouseJobRuns` run row and `job-results/` resultset is left
 * untouched (§8's "keep history" design call) — this Lambda has no
 * grant that could even reach them.
 */
export class Nyc311DeleteWarehouseJobApiLambda extends NodejsFunction {
  constructor(scope: Construct, id: string, props: Nyc311DeleteWarehouseJobApiLambdaProps) {
    const functionName = `Nyc311DeleteWarehouseJobApi-${ENV_NAME_SUFFIX[props.envName]}`;

    const logGroup = new logs.LogGroup(scope, `${id}LogGroup`, {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: logs.RetentionDays.ONE_MONTH,
    });

    const backendRoot = path.join(__dirname, "..", "..", "backend");

    super(scope, id, {
      functionName,
      entry: path.join(backendRoot, "controller", "web-api", "deleteWarehouseJobController.ts"),
      handler: "deleteWarehouseJobController",
      runtime: Runtime.NODEJS_22_X,
      timeout: Duration.seconds(15),
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
         * it — these two are unused by deleteWarehouseJob itself, but
         * still required to be present. The real least-privilege
         * boundary is IAM (below), not which env vars exist.
         */
        SCHEDULER_ROLE_ARN: props.jobScheduleGroup.invocationRole.roleArn,
        WAREHOUSE_JOB_RUNNER_FUNCTION_ARN: props.jobRunnerLambda.functionArn,
        WAREHOUSE_JOB_DLQ_ARN: props.jobScheduleGroup.deadLetterQueue.queueArn,
        WAREHOUSE_JOB_ENV_SUFFIX: ENV_NAME_SUFFIX[props.envName],
      },
    });

    props.jobRunsTable.grant(this, "dynamodb:GetItem", "dynamodb:DeleteItem");
    props.usersTable.grant(this, "dynamodb:Query", "dynamodb:PutItem");

    this.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["s3:DeleteObject"],
        resources: [`${props.warehouseBucket.bucket.bucketArn}/job-definitions/*`],
      })
    );

    const stack = Stack.of(this);
    this.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["scheduler:DeleteSchedule"],
        resources: [
          stack.formatArn({
            service: "scheduler",
            resource: "schedule",
            resourceName: `${props.jobScheduleGroup.scheduleGroupName}/*`,
          }),
        ],
      })
    );
  }
}
