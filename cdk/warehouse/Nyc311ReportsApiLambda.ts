import * as path from "node:path";
import { Duration, RemovalPolicy } from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";
import type { WarehouseJobRunsTable } from "../data/WarehouseJobRunsTable";
import type { Nyc311WarehouseBucket } from "./Nyc311WarehouseBucket";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311ReportsApiLambdaProps {
  envName: Nyc311Environment;
  jobRunsTable: WarehouseJobRunsTable;
  warehouseBucket: Nyc311WarehouseBucket;
}

/**
 * Backs the public `GET /reports` route (`7-data-warehousing.md` §12) —
 * the business-facing reporting surface. Per registered report job it
 * reads the latest `SUCCEEDED` run's `result.json` from S3 and reshapes
 * it into a week-over-week trend. Entry point is
 * `backend/controller/web-api/getReportsController.ts`. Read-only:
 * `dynamodb:Query` + `s3:GetObject` on `job-results/*`, no Athena.
 */
export class Nyc311ReportsApiLambda extends NodejsFunction {
  constructor(scope: Construct, id: string, props: Nyc311ReportsApiLambdaProps) {
    const functionName = `Nyc311ReportsApi-${ENV_NAME_SUFFIX[props.envName]}`;

    const logGroup = new logs.LogGroup(scope, `${id}LogGroup`, {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const backendRoot = path.join(__dirname, "..", "..", "backend");

    super(scope, id, {
      functionName,
      entry: path.join(backendRoot, "controller", "web-api", "getReportsController.ts"),
      handler: "getReportsController",
      runtime: Runtime.NODEJS_22_X,
      /* One S3 GetObject per registered report — well under 10s even with several. */
      timeout: Duration.seconds(10),
      memorySize: 256,
      logGroup,
      projectRoot: backendRoot,
      depsLockFilePath: path.join(backendRoot, "package-lock.json"),
      environment: {
        WAREHOUSE_JOB_RUNS_TABLE_NAME: props.jobRunsTable.tableName,
      },
    });

    props.jobRunsTable.grant(this, "dynamodb:Query");
    this.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["s3:GetObject"],
        resources: [`${props.warehouseBucket.bucket.bucketArn}/job-results/*`],
      })
    );
  }
}
