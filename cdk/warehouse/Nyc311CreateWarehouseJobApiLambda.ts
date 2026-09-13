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

export interface Nyc311CreateWarehouseJobApiLambdaProps {
  envName: Nyc311Environment;
  jobRunsTable: WarehouseJobRunsTable;
  usersTable: UsersTable;
  warehouseBucket: Nyc311WarehouseBucket;
  jobRunnerLambda: Nyc311WarehouseJobRunnerLambda;
  jobScheduleGroup: Nyc311WarehouseJobScheduleGroup;
}

/**
 * Backs admin-authorized `POST /admin/warehouse/jobs`
 * (`7-data-warehousing.md` §12b, Leg 8) — entry point is
 * `backend/controller/web-api/createWarehouseJobController.ts`. The one
 * Lambda in this doc that manages another Lambda's schedules, so its
 * `iam:PassRole` scope is what matters: exactly one role ARN, never a
 * wildcard — that role can only ever invoke the job runner, so passing
 * it grants nothing beyond what this feature needs.
 */
export class Nyc311CreateWarehouseJobApiLambda extends NodejsFunction {
  constructor(scope: Construct, id: string, props: Nyc311CreateWarehouseJobApiLambdaProps) {
    const functionName = `Nyc311CreateWarehouseJobApi-${ENV_NAME_SUFFIX[props.envName]}`;

    const logGroup = new logs.LogGroup(scope, `${id}LogGroup`, {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: logs.RetentionDays.ONE_MONTH,
    });

    const backendRoot = path.join(__dirname, "..", "..", "backend");

    super(scope, id, {
      functionName,
      entry: path.join(backendRoot, "controller", "web-api", "createWarehouseJobController.ts"),
      handler: "createWarehouseJobController",
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
        SCHEDULER_ROLE_ARN: props.jobScheduleGroup.invocationRole.roleArn,
        WAREHOUSE_JOB_RUNNER_FUNCTION_ARN: props.jobRunnerLambda.functionArn,
        WAREHOUSE_JOB_DLQ_ARN: props.jobScheduleGroup.deadLetterQueue.queueArn,
        WAREHOUSE_JOB_ENV_SUFFIX: ENV_NAME_SUFFIX[props.envName],
      },
    });

    props.jobRunsTable.grant(this, "dynamodb:PutItem");
    props.usersTable.grant(this, "dynamodb:Query", "dynamodb:PutItem");

    this.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["s3:PutObject"],
        resources: [`${props.warehouseBucket.bucket.bucketArn}/job-definitions/*`],
      })
    );

    const stack = Stack.of(this);
    this.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["scheduler:CreateSchedule"],
        resources: [
          stack.formatArn({
            service: "scheduler",
            resource: "schedule",
            resourceName: `${props.jobScheduleGroup.scheduleGroupName}/*`,
          }),
        ],
      })
    );

    /*
     * Scoped to exactly one role ARN — an unscoped iam:PassRole here
     * would let a caller hand any role to any schedule target.
     */
    this.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["iam:PassRole"],
        resources: [props.jobScheduleGroup.invocationRole.roleArn],
      })
    );
  }
}
