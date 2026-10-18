import * as path from "node:path";
import { Duration, RemovalPolicy } from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { NYC311_LAMBDA_BUNDLING } from "../lambda/lambdaBundling";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";
import type { LiveWorkspaceMetricsTable } from "../data/LiveWorkspaceMetricsTable";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311WorkspaceMetricsApiLambdaProps {
  envName: Nyc311Environment;
  liveWorkspaceMetricsTable: LiveWorkspaceMetricsTable;
}

/**
 * Backs the public `GET /workspace/metrics` route — the secondary
 * workspace's metric tiles, read from the live day buckets. Its own Lambda
 * so its `Duration` metric (Lambda Health) is this endpoint's latency
 * alone. Entry point is
 * `backend/controller/web-api/getWorkspaceMetricsController.ts`.
 * Read-only: BatchGetItem on that one table.
 */
export class Nyc311WorkspaceMetricsApiLambda extends NodejsFunction {
  constructor(scope: Construct, id: string, props: Nyc311WorkspaceMetricsApiLambdaProps) {
    const functionName = `Nyc311WorkspaceMetricsApi-${ENV_NAME_SUFFIX[props.envName]}`;

    const logGroup = new logs.LogGroup(scope, `${id}LogGroup`, {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const backendRoot = path.join(__dirname, "..", "..", "backend");

    super(scope, id, {
      functionName,
      entry: path.join(backendRoot, "controller", "web-api", "getWorkspaceMetricsController.ts"),
      handler: "getWorkspaceMetricsController",
      runtime: Runtime.NODEJS_22_X,
      bundling: NYC311_LAMBDA_BUNDLING,
      timeout: Duration.seconds(10),
      memorySize: 256,
      logGroup,
      projectRoot: backendRoot,
      depsLockFilePath: path.join(backendRoot, "package-lock.json"),
      environment: {
        LIVE_WORKSPACE_METRICS_TABLE_NAME: props.liveWorkspaceMetricsTable.tableName,
      },
    });

    props.liveWorkspaceMetricsTable.grant(this, "dynamodb:BatchGetItem");
  }
}
