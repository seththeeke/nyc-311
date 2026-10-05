import * as path from "node:path";
import { Duration, RemovalPolicy } from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { NYC311_LAMBDA_BUNDLING } from "./lambdaBundling";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";
import type { IStateMachine } from "aws-cdk-lib/aws-stepfunctions";
import type { OrdersTable } from "../data/OrdersTable";
import type { RequestsTable } from "../data/RequestsTable";
import type { LocationsTable } from "../data/LocationsTable";
import type { OperatorsTable } from "../data/OperatorsTable";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

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
export class Nyc311OrderSchedulingLambda extends NodejsFunction {
  constructor(scope: Construct, id: string, props: Nyc311OrderSchedulingLambdaProps) {
    const functionName = `Nyc311OrderScheduling-${ENV_NAME_SUFFIX[props.envName]}`;

    const logGroup = new logs.LogGroup(scope, `${id}LogGroup`, {
      logGroupName: `/aws/lambda/${functionName}`, /* matches Lambda's own default log group naming convention */
      retention: logs.RetentionDays.ONE_MONTH,
      /*
       * DESTROY, not the LogGroup default of RETAIN — if a deploy that
       * first creates this Lambda fails and rolls back, a RETAINed log
       * group is orphaned in the account, and the next deploy's changeset
       * then fails preflight (ResourceExistenceCheck) trying to recreate a
       * name that already exists. DESTROY lets the rollback clean it up.
       */
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const backendRoot = path.join(__dirname, "..", "..", "backend");

    super(scope, id, {
      functionName,
      entry: path.join(backendRoot, "controller", "order-processing", "scheduleOrdersController.ts"),
      handler: "scheduleOrdersController",
      runtime: Runtime.NODEJS_22_X,
      bundling: NYC311_LAMBDA_BUNDLING,
      timeout: Duration.minutes(5),
      memorySize: 256,
      logGroup,
      /*
       * backend/ is its own npm package (own lockfile/node_modules),
       * separate from cdk/ — see Nyc311PollerLambda for the same note.
       */
      projectRoot: backendRoot,
      depsLockFilePath: path.join(backendRoot, "package-lock.json"),
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
