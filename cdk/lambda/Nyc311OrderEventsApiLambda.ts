import * as path from "node:path";
import { Duration } from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";
import type { OrdersTable } from "../data/OrdersTable";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311OrderEventsApiLambdaProps {
  envName: Nyc311Environment;
  ordersTable: OrdersTable;
}

/**
 * Backs the public `GET /order-events` route (`5-order-evaluation.md`'s
 * Order Events list view) — entry point is `backend/controller/web-api/
 * getOrderEventsController.ts`. Read-only: grants `dynamodb:Scan` and
 * `dynamodb:Query` (`OrderDao.listOrderEvents`'s two query shapes),
 * nothing broader — this Lambda never writes.
 */
export class Nyc311OrderEventsApiLambda extends NodejsFunction {
  constructor(scope: Construct, id: string, props: Nyc311OrderEventsApiLambdaProps) {
    const functionName = `Nyc311OrderEventsApi-${ENV_NAME_SUFFIX[props.envName]}`;

    const logGroup = new logs.LogGroup(scope, `${id}LogGroup`, {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: logs.RetentionDays.ONE_MONTH,
    });

    const backendRoot = path.join(__dirname, "..", "..", "backend");

    super(scope, id, {
      functionName,
      entry: path.join(backendRoot, "controller", "web-api", "getOrderEventsController.ts"),
      handler: "getOrderEventsController",
      runtime: Runtime.NODEJS_22_X,
      timeout: Duration.seconds(10),
      memorySize: 256,
      logGroup,
      projectRoot: backendRoot,
      depsLockFilePath: path.join(backendRoot, "package-lock.json"),
      environment: {
        ORDERS_TABLE_NAME: props.ordersTable.tableName,
      },
    });

    props.ordersTable.grant(this, "dynamodb:Scan", "dynamodb:Query");
  }
}
