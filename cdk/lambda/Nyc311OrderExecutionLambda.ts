import * as path from "node:path";
import { Duration, RemovalPolicy } from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";
import type { OrdersTable } from "../data/OrdersTable";
import type { OperatorsTable } from "../data/OperatorsTable";
import type { RequestsTable } from "../data/RequestsTable";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311OrderExecutionLambdaProps {
  envName: Nyc311Environment;
  ordersTable: OrdersTable;
  operatorsTable: OperatorsTable;
  requestsTable: RequestsTable;
  /** How much faster than real time the simulation runs (§3.3) — `100` for Test, `1` for Prod. */
  simulationTimeScale: number;
}

/**
 * `Nyc311OrderExecutionLambda` — one phase-routed Lambda backing every
 * Task in `Nyc311OrderExecutionStateMachine`
 * (`10-capacity-modeling-and-integration.md` §3.2), same
 * one-Lambda-per-state-machine precedent as `Nyc311WarehouseRebuildWorker`.
 * Entry: `backend/controller/order-processing/orderExecutionController.ts`.
 * Least-privilege: Orders + Operators read/write, Requests read-only
 * (Dispatch's live processing-time re-estimate) — no Query anywhere.
 */
export class Nyc311OrderExecutionLambda extends NodejsFunction {
  constructor(scope: Construct, id: string, props: Nyc311OrderExecutionLambdaProps) {
    const functionName = `Nyc311OrderExecution-${ENV_NAME_SUFFIX[props.envName]}`;

    const logGroup = new logs.LogGroup(scope, `${id}LogGroup`, {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const backendRoot = path.join(__dirname, "..", "..", "backend");

    super(scope, id, {
      functionName,
      entry: path.join(backendRoot, "controller", "order-processing", "orderExecutionController.ts"),
      handler: "orderExecutionController",
      runtime: Runtime.NODEJS_22_X,
      timeout: Duration.seconds(30),
      memorySize: 256,
      logGroup,
      projectRoot: backendRoot,
      depsLockFilePath: path.join(backendRoot, "package-lock.json"),
      environment: {
        ORDERS_TABLE_NAME: props.ordersTable.tableName,
        OPERATORS_TABLE_NAME: props.operatorsTable.tableName,
        REQUESTS_TABLE_NAME: props.requestsTable.tableName,
        SIMULATION_TIME_SCALE: String(props.simulationTimeScale),
      },
    });

    props.ordersTable.grant(this, "dynamodb:GetItem", "dynamodb:PutItem");
    props.operatorsTable.grant(this, "dynamodb:GetItem", "dynamodb:PutItem");
    props.requestsTable.grant(this, "dynamodb:GetItem");
  }
}
