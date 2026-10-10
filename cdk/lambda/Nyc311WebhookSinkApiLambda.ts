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

export const WEBHOOK_SINK_API_OPERATIONS = ["RECEIVE", "LIST"] as const;
export type WebhookSinkApiOperation = (typeof WEBHOOK_SINK_API_OPERATIONS)[number];

interface OperationConfig {
  /** Physical-name stem, suffixed `-<Env>`. */
  functionStem: string;
  /** Exported handler in `backend/controller/web-api/<controller>.ts`. */
  controller: string;
  tableActions: string[];
  /** Only the receiver verifies signatures, so only it reads the sink's secret. */
  readsSecret: boolean;
}

export const WEBHOOK_SINK_OPERATION_CONFIG: Record<WebhookSinkApiOperation, OperationConfig> = {
  RECEIVE: {
    functionStem: "Nyc311ReceiveWebhookSinkApi",
    controller: "receiveWebhookSinkController",
    tableActions: ["dynamodb:PutItem"],
    readsSecret: true,
  },
  LIST: {
    functionStem: "Nyc311GetWebhookSinkDeliveriesApi",
    controller: "getWebhookSinkDeliveriesController",
    tableActions: ["dynamodb:Scan"],
    readsSecret: false,
  },
};

export interface Nyc311WebhookSinkApiLambdaProps {
  envName: Nyc311Environment;
  operation: WebhookSinkApiOperation;
  webhookSinkDeliveriesTable: WebhookSinkDeliveriesTable;
}

/**
 * One route of the Test-only webhook sink (`13-customer-simulation.md`
 * §5) — a real subscriber, so registration, dispatch, signing, delivery
 * and verification all run in Test. One construct parameterized by
 * operation, same shape as `Nyc311FeatureFlagApiLambda`.
 */
export class Nyc311WebhookSinkApiLambda extends NodejsFunction {
  constructor(scope: Construct, id: string, props: Nyc311WebhookSinkApiLambdaProps) {
    const config = WEBHOOK_SINK_OPERATION_CONFIG[props.operation];
    const functionName = `${config.functionStem}-${ENV_NAME_SUFFIX[props.envName]}`;

    const logGroup = new logs.LogGroup(scope, `${id}LogGroup`, {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const backendRoot = path.join(__dirname, "..", "..", "backend");

    super(scope, id, {
      functionName,
      entry: path.join(backendRoot, "controller", "web-api", `${config.controller}.ts`),
      handler: config.controller,
      runtime: Runtime.NODEJS_22_X,
      bundling: NYC311_LAMBDA_BUNDLING,
      timeout: Duration.seconds(10),
      memorySize: 512,
      logGroup,
      projectRoot: backendRoot,
      depsLockFilePath: path.join(backendRoot, "package-lock.json"),
      environment: {
        WEBHOOK_SINK_DELIVERIES_TABLE_NAME: props.webhookSinkDeliveriesTable.tableName,
        ...(config.readsSecret ? { WEBHOOK_SINK_SECRET_PARAMETER_NAME } : {}),
      },
    });

    props.webhookSinkDeliveriesTable.grant(this, ...config.tableActions);
    if (config.readsSecret) {
      this.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ["ssm:GetParameter"],
          resources: [
            Stack.of(this).formatArn({ service: "ssm", resource: "parameter", resourceName: WEBHOOK_SINK_SECRET_PARAMETER_NAME.slice(1) }),
          ],
        })
      );
    }
  }
}
