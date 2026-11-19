import { Duration, Stack } from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import type { Construct } from "constructs";
import type { LiveWorkspaceMetricsTable } from "../data/LiveWorkspaceMetricsTable";
import type { Nyc311WarehouseCatalog } from "./Nyc311WarehouseCatalog";
import type { Nyc311Environment } from "../stack/Nyc311Stack";
import { Nyc311Function } from "../lambda/Nyc311Function";

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
export class Nyc311DataApiLambda extends Nyc311Function {
  constructor(scope: Construct, id: string, props: Nyc311DataApiLambdaProps) {
    super(scope, id, {
      envName: props.envName,
      name: "Nyc311DataApi",
      entry: ["controller", "web-api", "data", "dataApiRouter.ts"],
      handler: "dataApiRouter",
      timeout: Duration.seconds(10),
      memorySize: 256,
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
