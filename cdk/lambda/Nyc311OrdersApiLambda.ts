import * as path from "node:path";
import { Duration } from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";
import type { OrdersTable } from "../data/OrdersTable";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311OrdersApiLambdaProps {
  envName: Nyc311Environment;
  ordersTable: OrdersTable;
}

/**
 * Backs the public `GET /orders` route (3-order-ingestion.md's Order list
 * view) — entry point is `backend/controller/web-api/
 * getOrdersController.ts`. Read-only: grants exactly `dynamodb:Scan`
 * against the OrdersTable (`OrderDao.listOrders`'s query shape), nothing
 * broader — this Lambda never writes.
 */
export class Nyc311OrdersApiLambda extends NodejsFunction {
  constructor(scope: Construct, id: string, props: Nyc311OrdersApiLambdaProps) {
    const functionName = `Nyc311OrdersApi-${ENV_NAME_SUFFIX[props.envName]}`;

    const logGroup = new logs.LogGroup(scope, `${id}LogGroup`, {
      logGroupName: `/aws/lambda/${functionName}`, /* matches Lambda's own default log group naming convention */
      retention: logs.RetentionDays.ONE_MONTH,
    });

    const backendRoot = path.join(__dirname, "..", "..", "backend");

    super(scope, id, {
      functionName,
      entry: path.join(backendRoot, "controller", "web-api", "getOrdersController.ts"),
      handler: "getOrdersController",
      runtime: Runtime.NODEJS_22_X,
      timeout: Duration.seconds(10),
      memorySize: 256,
      logGroup,
      /* backend/ is its own npm package (own lockfile/node_modules), separate from cdk/. */
      projectRoot: backendRoot,
      depsLockFilePath: path.join(backendRoot, "package-lock.json"),
      environment: {
        ORDERS_TABLE_NAME: props.ordersTable.tableName,
      },
    });

    props.ordersTable.grant(this, "dynamodb:Scan");
  }
}
