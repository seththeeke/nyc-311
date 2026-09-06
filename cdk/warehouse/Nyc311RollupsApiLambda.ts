import * as path from "node:path";
import { Duration, RemovalPolicy } from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";
import type { AnalyticsRollupsTable } from "../data/AnalyticsRollupsTable";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311RollupsApiLambdaProps {
  envName: Nyc311Environment;
  rollupsTable: AnalyticsRollupsTable;
}

/**
 * Backs the public `GET /data/rollups` route (`7-data-warehousing.md`
 * §12) — the sample job's pre-aggregated output from `AnalyticsRollups`,
 * most recent first. Entry point is `backend/controller/web-api/
 * getRollupsController.ts`. Read-only: grants `dynamodb:Query` (the
 * single `metric_view = :mv` read) and nothing else — this Lambda never
 * writes.
 */
export class Nyc311RollupsApiLambda extends NodejsFunction {
  constructor(scope: Construct, id: string, props: Nyc311RollupsApiLambdaProps) {
    const functionName = `Nyc311RollupsApi-${ENV_NAME_SUFFIX[props.envName]}`;

    const logGroup = new logs.LogGroup(scope, `${id}LogGroup`, {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const backendRoot = path.join(__dirname, "..", "..", "backend");

    super(scope, id, {
      functionName,
      entry: path.join(backendRoot, "controller", "web-api", "getRollupsController.ts"),
      handler: "getRollupsController",
      runtime: Runtime.NODEJS_22_X,
      timeout: Duration.seconds(10),
      memorySize: 256,
      logGroup,
      projectRoot: backendRoot,
      depsLockFilePath: path.join(backendRoot, "package-lock.json"),
      environment: {
        ANALYTICS_ROLLUPS_TABLE_NAME: props.rollupsTable.tableName,
      },
    });

    props.rollupsTable.grant(this, "dynamodb:Query");
  }
}
