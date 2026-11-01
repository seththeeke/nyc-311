import { Duration, Stack } from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import type * as sqs from "aws-cdk-lib/aws-sqs";
import type { Construct } from "constructs";
import { CustomerFunction } from "./CustomerFunction";
import { CUSTOMER_PUBLIC_API_BASE_URL } from "./customerConfig";
import type { ResidentIdeasTable } from "./ResidentIdeasTable";
import type { ResidentsTable } from "./ResidentsTable";

export interface CustomerActionWorkerLambdaProps {
  residentsTable: ResidentsTable;
  ideasTable: ResidentIdeasTable;
  ideaActionsQueue: sqs.IQueue;
  /** Every Bedrock model a resident is configured with. */
  modelIds: string[];
}

/* At most this many ideas are worked at once, so a burst queues instead of fanning out (§3 Flow B decision 8). */
export const ACTION_WORKER_MAX_CONCURRENCY = 2;

/**
 * The action worker (docs/16-resident-action-models.md §5.2): one idea
 * per invocation, worked as an LLM loop over BoroughSim's public API.
 * Reads residents; reads and writes ideas, steps and threads; invokes only
 * the configured models; reaches BoroughSim only at its public URL.
 */
export class CustomerActionWorkerLambda extends CustomerFunction {
  constructor(scope: Construct, id: string, props: CustomerActionWorkerLambdaProps) {
    super(scope, id, {
      name: "CustomerActionWorker",
      entry: ["controller", "action", "runIdeaActionsController.ts"],
      handler: "runIdeaActionsController",
      timeout: Duration.minutes(3),
      memorySize: 512,
      environment: {
        RESIDENTS_TABLE_NAME: props.residentsTable.tableName,
        RESIDENT_IDEAS_TABLE_NAME: props.ideasTable.tableName,
        PUBLIC_API_BASE_URL: CUSTOMER_PUBLIC_API_BASE_URL,
      },
    });
    props.residentsTable.grant(this, "dynamodb:GetItem");
    props.ideasTable.grant(this, "dynamodb:Query", "dynamodb:PutItem", "dynamodb:UpdateItem");
    const region = Stack.of(this).region;
    this.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["bedrock:InvokeModel"],
        resources: [...new Set(props.modelIds)].sort().map((modelId) => `arn:aws:bedrock:${region}::foundation-model/${modelId}`),
      })
    );
    this.addEventSource(new SqsEventSource(props.ideaActionsQueue, { batchSize: 1, maxConcurrency: ACTION_WORKER_MAX_CONCURRENCY }));
  }
}
