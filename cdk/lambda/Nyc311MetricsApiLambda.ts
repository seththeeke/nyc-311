import * as path from "node:path";
import { Duration } from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";
import type { RequestsTable } from "../data/RequestsTable";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311MetricsApiLambdaProps {
  envName: Nyc311Environment;
  requestsTable: RequestsTable;
}

/**
 * Backs the public `GET /ingestion/metrics` route (1-data-ingestion.md
 * §8a, cursor section added 2026-08-22) — entry point is
 * `backend/controller/web-api/getPollerMetricsController.ts`. Read-only:
 * grants `dynamodb:Query` (the `gsi4-poller-metrics` index Query
 * `RequestDao.listPollerMetrics` issues) and `dynamodb:GetItem` (the
 * `CURSOR#NYC_311` sentinel item `RequestDao.getCursor` reads, added for
 * `getCursorStatus`), nothing broader — this Lambda never writes.
 */
export class Nyc311MetricsApiLambda extends NodejsFunction {
  constructor(scope: Construct, id: string, props: Nyc311MetricsApiLambdaProps) {
    const functionName = `Nyc311MetricsApi-${ENV_NAME_SUFFIX[props.envName]}`;

    const logGroup = new logs.LogGroup(scope, `${id}LogGroup`, {
      logGroupName: `/aws/lambda/${functionName}`, /* matches Lambda's own default log group naming convention */
      retention: logs.RetentionDays.ONE_MONTH,
    });

    const backendRoot = path.join(__dirname, "..", "..", "backend");

    super(scope, id, {
      functionName,
      entry: path.join(backendRoot, "controller", "web-api", "getPollerMetricsController.ts"),
      handler: "getPollerMetricsController",
      runtime: Runtime.NODEJS_22_X,
      timeout: Duration.seconds(10),
      memorySize: 256,
      logGroup,
      /*
       * backend/ is its own npm package (own lockfile/node_modules),
       * separate from cdk/ — see Nyc311PollerLambda for the same note.
       */
      projectRoot: backendRoot,
      depsLockFilePath: path.join(backendRoot, "package-lock.json"),
      environment: {
        REQUESTS_TABLE_NAME: props.requestsTable.tableName,
      },
    });

    props.requestsTable.grant(this, "dynamodb:Query", "dynamodb:GetItem");
  }
}
