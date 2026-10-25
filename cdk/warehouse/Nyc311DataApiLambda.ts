import * as path from "node:path";
import { Duration, RemovalPolicy, Stack } from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { NYC311_LAMBDA_BUNDLING } from "../lambda/lambdaBundling";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";
import type { LiveWorkspaceMetricsTable } from "../data/LiveWorkspaceMetricsTable";
import type { Nyc311WarehouseCatalog } from "./Nyc311WarehouseCatalog";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311DataApiLambdaProps {
  envName: Nyc311Environment;
  warehouseCatalog: Nyc311WarehouseCatalog;
  liveWorkspaceMetricsTable: LiveWorkspaceMetricsTable;
}

/**
 * The data Service API bundle (`15-resource-consolidation.md` §3.3):
 * `GET /data/schema` and `GET /workspace/metrics`, entry
 * `backend/controller/web-api/data/dataApiRouter.ts`. Read-only: Glue
 * catalog reads and a BatchGetItem on the live metrics table.
 */
export class Nyc311DataApiLambda extends NodejsFunction {
  constructor(scope: Construct, id: string, props: Nyc311DataApiLambdaProps) {
    const functionName = `Nyc311DataApi-${ENV_NAME_SUFFIX[props.envName]}`;

    const logGroup = new logs.LogGroup(scope, `${id}LogGroup`, {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const backendRoot = path.join(__dirname, "..", "..", "backend");

    super(scope, id, {
      functionName,
      entry: path.join(backendRoot, "controller", "web-api", "data", "dataApiRouter.ts"),
      handler: "dataApiRouter",
      runtime: Runtime.NODEJS_22_X,
      bundling: NYC311_LAMBDA_BUNDLING,
      timeout: Duration.seconds(10),
      memorySize: 256,
      logGroup,
      projectRoot: backendRoot,
      depsLockFilePath: path.join(backendRoot, "package-lock.json"),
      environment: {
        WAREHOUSE_DATABASE_NAME: props.warehouseCatalog.databaseName,
        LIVE_WORKSPACE_METRICS_TABLE_NAME: props.liveWorkspaceMetricsTable.tableName,
      },
    });

    const stack = Stack.of(this);
    this.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["glue:GetDatabase", "glue:GetTable", "glue:GetTables"],
        resources: [
          stack.formatArn({ service: "glue", resource: "catalog" }),
          stack.formatArn({ service: "glue", resource: "database", resourceName: props.warehouseCatalog.databaseName }),
          stack.formatArn({ service: "glue", resource: "table", resourceName: `${props.warehouseCatalog.databaseName}/*` }),
        ],
      })
    );
    props.liveWorkspaceMetricsTable.grant(this, "dynamodb:BatchGetItem");
  }
}
