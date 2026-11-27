import { Duration } from "aws-cdk-lib";
import type { Construct } from "constructs";
import type { IStateMachine } from "aws-cdk-lib/aws-stepfunctions";
import type { OrdersTable } from "../data/OrdersTable";
import type { RequestsTable } from "../data/RequestsTable";
import type { LocationsTable } from "../data/LocationsTable";
import type { OperatorsTable } from "../data/OperatorsTable";
import type { FeatureFlagsTable } from "../data/FeatureFlagsTable";
import type { ITopic } from "aws-cdk-lib/aws-sns";
import { FeatureFlagReadMetricFilters } from "./FeatureFlagReadMetricFilters";
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
  /** DISPATCH_POLICY is read once per pass (20-ml-driver-assignment.md §3.1, #202). */
  featureFlagsTable: FeatureFlagsTable;
  /** Each committed dispatch publishes one `dispatch_decisions` row here (§2.4). */
  dispatchDecisionsTopic: ITopic;
}

/**
 * The order-scheduling job Lambda, entry `scheduleOrdersController.ts`
 * (`6-order-scheduling.md`, amended by
 * `10-capacity-modeling-and-integration.md` §3.5/§3.6). Least-privilege:
 * Orders read/write, Requests/Locations read-only, Operators
 * read/write/query, `states:StartExecution` on the execution state
 * machine, GetItem on the flag table (DISPATCH_POLICY) and publish to the
 * dispatch-decisions topic (`20-ml-driver-assignment.md` §2.4).
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
        FEATURE_FLAGS_TABLE_NAME: props.featureFlagsTable.tableName,
        DISPATCH_DECISIONS_TOPIC_ARN: props.dispatchDecisionsTopic.topicArn,
      },
    });

    props.ordersTable.grant(this, "dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:Query");
    props.requestsTable.grant(this, "dynamodb:GetItem");
    props.locationsTable.grant(this, "dynamodb:GetItem");
    props.operatorsTable.grant(this, "dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:Query");
    props.orderExecutionStateMachine.grantStartExecution(this);
    props.featureFlagsTable.grantFlagRead(this);
    props.dispatchDecisionsTopic.grantPublish(this);
    new FeatureFlagReadMetricFilters(this, "FeatureFlagReadMetricFilters", { logGroup: this.functionLogGroup });
  }
}
