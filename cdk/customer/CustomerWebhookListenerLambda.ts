import * as path from "node:path";
import { Duration, RemovalPolicy, Stack } from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";
import { CUSTOMER_BACKEND_ROOT } from "./customerBackendRoot";
import { CUSTOMER_ENV_SUFFIX, CUSTOMER_LAMBDA_BUNDLING, CUSTOMER_SIGNING_SECRET_PARAMETER_NAME } from "./customerConfig";
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
export class CustomerWebhookListenerLambda extends NodejsFunction {
  constructor(scope: Construct, id: string, props: CustomerWebhookListenerLambdaProps) {
    const functionName = `CustomerWebhookListener-${CUSTOMER_ENV_SUFFIX}`;

    const logGroup = new logs.LogGroup(scope, `${id}LogGroup`, {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    super(scope, id, {
      functionName,
      entry: path.join(CUSTOMER_BACKEND_ROOT, "controller", "webhook", "receiveWebhookController.ts"),
      handler: "receiveWebhookController",
      runtime: Runtime.NODEJS_22_X,
      bundling: CUSTOMER_LAMBDA_BUNDLING,
      timeout: Duration.seconds(10),
      memorySize: 256,
      logGroup,
      projectRoot: CUSTOMER_BACKEND_ROOT,
      depsLockFilePath: path.join(CUSTOMER_BACKEND_ROOT, "package-lock.json"),
      environment: {
        CUSTOMER_ORDERS_TABLE_NAME: props.ordersTable.tableName,
        CUSTOMER_SIGNING_SECRET_PARAMETER_NAME,
      },
    });

    /* Least privilege: put rows in its own table, and read its own one secret. Nothing of the bureau's. */
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
