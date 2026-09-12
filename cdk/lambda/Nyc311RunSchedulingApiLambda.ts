import * as path from "node:path";
import { Duration } from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";
import type { IStateMachine } from "aws-cdk-lib/aws-stepfunctions";
import type { OrdersTable } from "../data/OrdersTable";
import type { RequestsTable } from "../data/RequestsTable";
import type { LocationsTable } from "../data/LocationsTable";
import type { OperatorsTable } from "../data/OperatorsTable";
import type { UsersTable } from "../data/UsersTable";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311RunSchedulingApiLambdaProps {
  envName: Nyc311Environment;
  ordersTable: OrdersTable;
  requestsTable: RequestsTable;
  locationsTable: LocationsTable;
  operatorsTable: OperatorsTable;
  usersTable: UsersTable;
  orderExecutionStateMachine: IStateMachine;
}

/**
 * Backs the admin-authorized `POST /scheduling/run` route
 * (`10-capacity-modeling-and-integration.md` §5.1) — an on-demand trigger
 * for testing purposes, calling the exact same `scheduleOrders` service
 * function the `rate(1 hour)` `Nyc311OrderSchedulingLambda` already runs.
 * Entry: `backend/controller/web-api/runSchedulingController.ts`. Same
 * grants as that scheduled Lambda, plus `UsersTable` for `requireAdminUser`.
 */
export class Nyc311RunSchedulingApiLambda extends NodejsFunction {
  constructor(scope: Construct, id: string, props: Nyc311RunSchedulingApiLambdaProps) {
    const functionName = `Nyc311RunSchedulingApi-${ENV_NAME_SUFFIX[props.envName]}`;

    const logGroup = new logs.LogGroup(scope, `${id}LogGroup`, {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: logs.RetentionDays.ONE_MONTH,
    });

    const backendRoot = path.join(__dirname, "..", "..", "backend");

    super(scope, id, {
      functionName,
      entry: path.join(backendRoot, "controller", "web-api", "runSchedulingController.ts"),
      handler: "runSchedulingController",
      runtime: Runtime.NODEJS_22_X,
      timeout: Duration.minutes(5),
      memorySize: 256,
      logGroup,
      projectRoot: backendRoot,
      depsLockFilePath: path.join(backendRoot, "package-lock.json"),
      environment: {
        ORDERS_TABLE_NAME: props.ordersTable.tableName,
        REQUESTS_TABLE_NAME: props.requestsTable.tableName,
        LOCATIONS_TABLE_NAME: props.locationsTable.tableName,
        OPERATORS_TABLE_NAME: props.operatorsTable.tableName,
        USERS_TABLE_NAME: props.usersTable.tableName,
        ORDER_EXECUTION_STATE_MACHINE_ARN: props.orderExecutionStateMachine.stateMachineArn,
      },
    });

    props.ordersTable.grant(this, "dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:Query");
    props.requestsTable.grant(this, "dynamodb:GetItem");
    props.locationsTable.grant(this, "dynamodb:GetItem");
    props.operatorsTable.grant(this, "dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:Query");
    props.usersTable.grant(this, "dynamodb:Query", "dynamodb:PutItem");
    props.orderExecutionStateMachine.grantStartExecution(this);
  }
}
