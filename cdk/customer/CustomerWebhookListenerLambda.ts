import { Duration, Stack } from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import type { Construct } from "constructs";
import { CUSTOMER_SIGNING_SECRET_PARAMETER_NAME } from "./customerConfig";
import { CustomerFunction } from "./CustomerFunction";
import type { WebhookCustomerFacingOrdersTable } from "./WebhookCustomerFacingOrdersTable";

export interface CustomerWebhookListenerLambdaProps {
  ordersTable: WebhookCustomerFacingOrdersTable;
}

/**
 * The customer's webhook listener (`13-customer-simulation.md` §3 Flow A)
 * — verifies each delivery's signature against the customer's own secret
 * and opens or closes the order. Entry point is the customer package's
 * `controller/webhook/receiveWebhookController.ts`.
 */
export class CustomerWebhookListenerLambda extends CustomerFunction {
  constructor(scope: Construct, id: string, props: CustomerWebhookListenerLambdaProps) {
    super(scope, id, {
      name: "CustomerWebhookListener",
      entry: ["controller", "webhook", "receiveWebhookController.ts"],
      handler: "receiveWebhookController",
      timeout: Duration.seconds(10),
      memorySize: 256,
      environment: {
        CUSTOMER_ORDERS_TABLE_NAME: props.ordersTable.tableName,
        CUSTOMER_SIGNING_SECRET_PARAMETER_NAME,
      },
    });

    /* Least privilege: put rows in its own table, and read its own one secret. Nothing of BoroughSim's. */
    props.ordersTable.grant(this, "dynamodb:PutItem");
    this.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ssm:GetParameter"],
        resources: [
          Stack.of(this).formatArn({ service: "ssm", resource: "parameter", resourceName: CUSTOMER_SIGNING_SECRET_PARAMETER_NAME.slice(1) }),
        ],
      })
    );
  }
}
