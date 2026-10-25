import * as path from "node:path";
import { Duration, RemovalPolicy, Stack } from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { NYC311_LAMBDA_BUNDLING } from "./lambdaBundling";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";
import type { WebhookSinkDeliveriesTable } from "../data/WebhookSinkDeliveriesTable";
import { WEBHOOK_SINK_SECRET_PARAMETER_NAME } from "./webhookConfig";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311WebhookSinkApiLambdaProps {
  envName: Nyc311Environment;
  webhookSinkDeliveriesTable: WebhookSinkDeliveriesTable;
}

/**
 * The webhookSink Service API bundle (`15-resource-consolidation.md`
 * §3.3), Test only: the sink's receive and list routes
 * (`13-customer-simulation.md` §5), entry
 * `backend/controller/web-api/webhookSink/webhookSinkApiRouter.ts`.
 */
export class Nyc311WebhookSinkApiLambda extends NodejsFunction {
  constructor(scope: Construct, id: string, props: Nyc311WebhookSinkApiLambdaProps) {
    const functionName = `Nyc311WebhookSinkApi-${ENV_NAME_SUFFIX[props.envName]}`;

    const logGroup = new logs.LogGroup(scope, `${id}LogGroup`, {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const backendRoot = path.join(__dirname, "..", "..", "backend");

    super(scope, id, {
      functionName,
      entry: path.join(backendRoot, "controller", "web-api", "webhookSink", "webhookSinkApiRouter.ts"),
      handler: "webhookSinkApiRouter",
      runtime: Runtime.NODEJS_22_X,
      bundling: NYC311_LAMBDA_BUNDLING,
      timeout: Duration.seconds(10),
      memorySize: 512,
      logGroup,
      projectRoot: backendRoot,
      depsLockFilePath: path.join(backendRoot, "package-lock.json"),
      environment: {
        WEBHOOK_SINK_DELIVERIES_TABLE_NAME: props.webhookSinkDeliveriesTable.tableName,
        WEBHOOK_SINK_SECRET_PARAMETER_NAME,
      },
    });

    props.webhookSinkDeliveriesTable.grant(this, "dynamodb:PutItem", "dynamodb:Scan");
    this.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ssm:GetParameter"],
        resources: [Stack.of(this).formatArn({ service: "ssm", resource: "parameter", resourceName: WEBHOOK_SINK_SECRET_PARAMETER_NAME.slice(1) })],
      })
    );
  }
}
