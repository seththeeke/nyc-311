import * as path from "node:path";
import { Duration, RemovalPolicy } from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";
import type { WarehouseJobRunsTable } from "../data/WarehouseJobRunsTable";
import type { UsersTable } from "../data/UsersTable";
import type { Nyc311WarehouseBucket } from "./Nyc311WarehouseBucket";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311GetWarehouseJobRunResultsApiLambdaProps {
  envName: Nyc311Environment;
  jobRunsTable: WarehouseJobRunsTable;
  usersTable: UsersTable;
  warehouseBucket: Nyc311WarehouseBucket;
}

/**
 * Backs admin-authorized `POST /admin/warehouse/job-runs/results`
 * (`7-data-warehousing.md` §12b's Reports tab addition) — a bulk fetch of
 * raw job-run results by `job_run_id`. Read-only: `dynamodb:GetItem` on
 * `WarehouseJobRuns` (a primary-key lookup, not a Query) plus
 * `s3:GetObject` scoped to `job-results/*`; never touches a job
 * *definition*, so unlike the SQL/Delete/Update lambdas this needs no
 * scheduler/job-runner props.
 */
export class Nyc311GetWarehouseJobRunResultsApiLambda extends NodejsFunction {
  constructor(scope: Construct, id: string, props: Nyc311GetWarehouseJobRunResultsApiLambdaProps) {
    const functionName = `Nyc311GetWarehouseJobRunResultsApi-${ENV_NAME_SUFFIX[props.envName]}`;

    const logGroup = new logs.LogGroup(scope, `${id}LogGroup`, {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const backendRoot = path.join(__dirname, "..", "..", "backend");

    super(scope, id, {
      functionName,
      entry: path.join(backendRoot, "controller", "web-api", "postJobRunResultsController.ts"),
      handler: "postJobRunResultsController",
      runtime: Runtime.NODEJS_22_X,
      /* A batch of ids fetches its S3 objects concurrently (Promise.all), but still longer than the single-item lambdas' 10s. */
      timeout: Duration.seconds(20),
      memorySize: 256,
      logGroup,
      projectRoot: backendRoot,
      depsLockFilePath: path.join(backendRoot, "package-lock.json"),
      environment: {
        WAREHOUSE_JOB_RUNS_TABLE_NAME: props.jobRunsTable.tableName,
        USERS_TABLE_NAME: props.usersTable.tableName,
      },
    });

    props.jobRunsTable.grant(this, "dynamodb:GetItem");
    props.usersTable.grant(this, "dynamodb:Query", "dynamodb:PutItem");

    this.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["s3:GetObject"],
        resources: [`${props.warehouseBucket.bucket.bucketArn}/job-results/*`],
      })
    );
  }
}
