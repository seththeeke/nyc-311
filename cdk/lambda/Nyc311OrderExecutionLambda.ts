import { Duration } from "aws-cdk-lib";
import type { Construct } from "constructs";
import type { OrdersTable } from "../data/OrdersTable";
import type { OperatorsTable } from "../data/OperatorsTable";
import type { RequestsTable } from "../data/RequestsTable";
import type { Nyc311Environment } from "../stack/Nyc311Stack";
import { Nyc311Function } from "./Nyc311Function";

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
export class Nyc311OrderExecutionLambda extends Nyc311Function {
  constructor(scope: Construct, id: string, props: Nyc311OrderExecutionLambdaProps) {
    super(scope, id, {
      envName: props.envName,
      name: "Nyc311OrderExecution",
      entry: ["controller", "order-processing", "orderExecutionController.ts"],
      handler: "orderExecutionController",
      timeout: Duration.seconds(30),
      memorySize: 256,
      environment: {
        ORDERS_TABLE_NAME: props.ordersTable.tableName,
        OPERATORS_TABLE_NAME: props.operatorsTable.tableName,
        REQUESTS_TABLE_NAME: props.requestsTable.tableName,
        SIMULATION_TIME_SCALE: String(props.simulationTimeScale),
      },
    });

    /* Query: the FAIL step checks gsi2-assigned-operator before freeing a vehicle (v1-prod-deployment.md F6). */
    props.ordersTable.grant(this, "dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:Query");
    props.operatorsTable.grant(this, "dynamodb:GetItem", "dynamodb:PutItem");
    props.requestsTable.grant(this, "dynamodb:GetItem");
  }
}
