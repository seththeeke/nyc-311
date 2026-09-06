import * as path from "node:path";
import { Duration, RemovalPolicy, Stack } from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";
import type { Nyc311WarehouseCatalog } from "./Nyc311WarehouseCatalog";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311WarehouseSchemaApiLambdaProps {
  envName: Nyc311Environment;
  warehouseCatalog: Nyc311WarehouseCatalog;
}

/**
 * Backs the public `GET /data/schema` route (`7-data-warehousing.md`
 * §12) — a live Glue Data Catalog read so a schema change surfaces on
 * `/data` with no code change. Entry point is `backend/controller/
 * web-api/getWarehouseSchemaController.ts`. Read-only: grants
 * `glue:GetTables`/`glue:GetTable` on the one warehouse database and
 * nothing else — this Lambda never writes.
 */
export class Nyc311WarehouseSchemaApiLambda extends NodejsFunction {
  constructor(scope: Construct, id: string, props: Nyc311WarehouseSchemaApiLambdaProps) {
    const functionName = `Nyc311WarehouseSchemaApi-${ENV_NAME_SUFFIX[props.envName]}`;

    const logGroup = new logs.LogGroup(scope, `${id}LogGroup`, {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const backendRoot = path.join(__dirname, "..", "..", "backend");

    super(scope, id, {
      functionName,
      entry: path.join(backendRoot, "controller", "web-api", "getWarehouseSchemaController.ts"),
      handler: "getWarehouseSchemaController",
      runtime: Runtime.NODEJS_22_X,
      timeout: Duration.seconds(10),
      memorySize: 256,
      logGroup,
      projectRoot: backendRoot,
      depsLockFilePath: path.join(backendRoot, "package-lock.json"),
      environment: {
        WAREHOUSE_DATABASE_NAME: props.warehouseCatalog.databaseName,
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
  }
}
