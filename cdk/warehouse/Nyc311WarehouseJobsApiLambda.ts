import * as path from "node:path";
import { Duration, RemovalPolicy } from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";
import type { WarehouseJobRunsTable } from "../data/WarehouseJobRunsTable";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311WarehouseJobsApiLambdaProps {
  envName: Nyc311Environment;
  jobRunsTable: WarehouseJobRunsTable;
}

/**
 * Backs the public `GET /data/jobs` route (`7-data-warehousing.md`
 * §12) — the most-recent-first job run history for `/data`. Entry point
 * is `backend/controller/web-api/getWarehouseJobRunsController.ts`.
 * Read-only: grants `dynamodb:Query` (the `gsi1-recent-runs` read) and
 * nothing else — this Lambda never writes.
 */
export class Nyc311WarehouseJobsApiLambda extends NodejsFunction {
  constructor(scope: Construct, id: string, props: Nyc311WarehouseJobsApiLambdaProps) {
    const functionName = `Nyc311WarehouseJobsApi-${ENV_NAME_SUFFIX[props.envName]}`;

    const logGroup = new logs.LogGroup(scope, `${id}LogGroup`, {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const backendRoot = path.join(__dirname, "..", "..", "backend");

    super(scope, id, {
      functionName,
      entry: path.join(backendRoot, "controller", "web-api", "getWarehouseJobRunsController.ts"),
      handler: "getWarehouseJobRunsController",
      runtime: Runtime.NODEJS_22_X,
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
  }
}
