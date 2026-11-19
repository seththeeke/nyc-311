import { Duration } from "aws-cdk-lib";
import type { Construct } from "constructs";
import type { IStateMachine } from "aws-cdk-lib/aws-stepfunctions";
import type { OrdersTable } from "../data/OrdersTable";
import type { RequestsTable } from "../data/RequestsTable";
import type { LocationsTable } from "../data/LocationsTable";
import type { OperatorsTable } from "../data/OperatorsTable";
import type { Nyc311Environment } from "../stack/Nyc311Stack";
import { Nyc311Function } from "./Nyc311Function";

export interface Nyc311OrderSchedulingLambdaProps {
  envName: Nyc311Environment;
  ordersTable: OrdersTable;
  requestsTable: RequestsTable;
  locationsTable: LocationsTable;
  operatorsTable: OperatorsTable;
  /** `Nyc311OrderExecutionStateMachine` — one execution started per scheduled Order (§3.2). */
  orderExecutionStateMachine: IStateMachine;
}

/**
 * The order-scheduling job Lambda — entry point is
 * `scheduleOrdersController.ts` (`6-order-scheduling.md`, amended by
 * `10-capacity-modeling-and-integration.md` §3.5/§3.6, which dropped the
 * old pool/budget grants). Least-privilege: Orders read/write, Requests/
 * Locations read-only (the timing estimators), Operators read/write/
 * query (the real idle-operator claim), and `states:StartExecution` on
 * the execution state machine.
 */
export class Nyc311OrderSchedulingLambda extends Nyc311Function {
  constructor(scope: Construct, id: string, props: Nyc311OrderSchedulingLambdaProps) {
    super(scope, id, {
      envName: props.envName,
      name: "Nyc311OrderScheduling",
      entry: ["controller", "order-processing", "scheduleOrdersController.ts"],
      handler: "scheduleOrdersController",
      timeout: Duration.minutes(5),
      memorySize: 256,
      environment: {
        ORDERS_TABLE_NAME: props.ordersTable.tableName,
        REQUESTS_TABLE_NAME: props.requestsTable.tableName,
        LOCATIONS_TABLE_NAME: props.locationsTable.tableName,
        OPERATORS_TABLE_NAME: props.operatorsTable.tableName,
        ORDER_EXECUTION_STATE_MACHINE_ARN: props.orderExecutionStateMachine.stateMachineArn,
      },
    });

    props.ordersTable.grant(this, "dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:Query");
    props.requestsTable.grant(this, "dynamodb:GetItem");
    props.locationsTable.grant(this, "dynamodb:GetItem");
    props.operatorsTable.grant(this, "dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:Query");
    props.orderExecutionStateMachine.grantStartExecution(this);
  }
}
