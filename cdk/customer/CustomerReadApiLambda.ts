import { Duration } from "aws-cdk-lib";
import type { Construct } from "constructs";
import { CustomerFunction } from "./CustomerFunction";
import type { ResidentIdeasTable } from "./ResidentIdeasTable";
import type { ResidentsTable } from "./ResidentsTable";
import type { WebhookCustomerFacingOrdersTable } from "./WebhookCustomerFacingOrdersTable";

export interface CustomerReadApiLambdaProps {
  residentsTable: ResidentsTable;
  ideasTable: ResidentIdeasTable;
  ordersTable: WebhookCustomerFacingOrdersTable;
}

/**
 * The public read API (`13-customer-simulation.md` §4, Appendix K): one
 * Lambda behind every `GET` route, read-only on all three tables.
 */
export class CustomerReadApiLambda extends CustomerFunction {
  constructor(scope: Construct, id: string, props: CustomerReadApiLambdaProps) {
    super(scope, id, {
      name: "CustomerReadApi",
      entry: ["controller", "read", "residentApiController.ts"],
      handler: "residentApiController",
      timeout: Duration.seconds(10),
      memorySize: 256,
      environment: {
        RESIDENTS_TABLE_NAME: props.residentsTable.tableName,
        RESIDENT_IDEAS_TABLE_NAME: props.ideasTable.tableName,
        CUSTOMER_ORDERS_TABLE_NAME: props.ordersTable.tableName,
      },
    });
    props.residentsTable.grant(this, "dynamodb:GetItem", "dynamodb:Query");
    props.ideasTable.grant(this, "dynamodb:GetItem", "dynamodb:Query");
    props.ordersTable.grant(this, "dynamodb:BatchGetItem");
  }
}
