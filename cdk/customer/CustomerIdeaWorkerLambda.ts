import { Duration, Stack } from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import type * as sqs from "aws-cdk-lib/aws-sqs";
import type { Construct } from "constructs";
import { CustomerFunction } from "./CustomerFunction";
import type { ResidentIdeasTable } from "./ResidentIdeasTable";
import type { ResidentsTable } from "./ResidentsTable";
import type { WebhookCustomerFacingOrdersTable } from "./WebhookCustomerFacingOrdersTable";

export interface CustomerIdeaWorkerLambdaProps {
  residentsTable: ResidentsTable;
  ideasTable: ResidentIdeasTable;
  ordersTable: WebhookCustomerFacingOrdersTable;
  /** Every Bedrock model a resident is configured with (§3 Flow B decision 2). */
  modelIds: string[];
  /** Where new ideas go for the action worker (docs/16 §5.2). */
  ideaActionsQueue: sqs.IQueue;
}

/**
 * The idea worker (`13-customer-simulation.md` §3 Flow B): one scheduled
 * thought per invocation — roll, gather, ask the resident's model, record.
 * Reads orders and residents; writes ideas, thread rows and resident
 * counters; invokes only the configured models; queues each new idea for
 * the action worker.
 */
export class CustomerIdeaWorkerLambda extends CustomerFunction {
  constructor(scope: Construct, id: string, props: CustomerIdeaWorkerLambdaProps) {
    super(scope, id, {
      name: "CustomerIdeaWorker",
      entry: ["controller", "idea", "generateIdeaController.ts"],
      handler: "generateIdeaController",
      timeout: Duration.seconds(60),
      memorySize: 512,
      environment: {
        RESIDENTS_TABLE_NAME: props.residentsTable.tableName,
        RESIDENT_IDEAS_TABLE_NAME: props.ideasTable.tableName,
        CUSTOMER_ORDERS_TABLE_NAME: props.ordersTable.tableName,
        IDEA_ACTIONS_QUEUE_URL: props.ideaActionsQueue.queueUrl,
      },
    });
    props.residentsTable.grant(this, "dynamodb:GetItem", "dynamodb:UpdateItem");
    props.ideasTable.grant(this, "dynamodb:Query", "dynamodb:PutItem", "dynamodb:UpdateItem");
    props.ordersTable.grant(this, "dynamodb:Query", "dynamodb:BatchGetItem");
    props.ideaActionsQueue.grantSendMessages(this);
    const region = Stack.of(this).region;
    this.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["bedrock:InvokeModel"],
        resources: [...new Set(props.modelIds)].sort().map((modelId) => `arn:aws:bedrock:${region}::foundation-model/${modelId}`),
      })
    );
  }
}
