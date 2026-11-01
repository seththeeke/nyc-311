import * as path from "node:path";
import { Duration, RemovalPolicy } from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { NYC311_LAMBDA_BUNDLING } from "./lambdaBundling";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";
import type { RequestsTable } from "../data/RequestsTable";
import { PIPELINE_STATUS_FUNCTION_NAME } from "../pipeline/Nyc311PipelineStatusLambda";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311MonitoringApiLambdaProps {
  envName: Nyc311Environment;
  requestsTable: RequestsTable;
  /* Physical function names of every Lambda the health tile covers; this bundle adds its own. */
  pollerFunctionName: string;
  orderFanOutFunctionName: string;
  requestEvaluationFunctionName: string;
  orderEventFanOutFunctionName: string;
  locationsFanOutFunctionName: string;
  operatorsFanOutFunctionName: string;
  orderEvaluationFunctionName: string;
  orderSchedulingFunctionName: string;
  warehouseJobRunnerFunctionName: string;
  adminApiFunctionName: string;
  featureFlagsApiFunctionName: string;
  dataApiFunctionName: string;
  fleetApiFunctionName: string;
  webhookSubscriptionsApiFunctionName: string;
  /** The public API's bundle Lambda (16-resident-action-models.md §2), on the Lambda health tile. */
  publicV1ApiFunctionName: string;
  /** The public API's HTTP API id — `GET /public-api/metrics` reads its built-in metrics. */
  publicApiId: string;
}

/**
 * The monitoring Service API bundle (`15-resource-consolidation.md`
 * §3.3): `GET /ingestion/metrics`, `GET /lambda-metrics` and
 * `GET /public-api/metrics`, entry
 * `backend/controller/web-api/monitoring/monitoringApiRouter.ts`. Its
 * timeout is the Lambda-health route's: up to 48 parallel CloudWatch calls
 * (16 monitored Lambdas × 3 metrics), itself among them.
 */
export class Nyc311MonitoringApiLambda extends NodejsFunction {
  constructor(scope: Construct, id: string, props: Nyc311MonitoringApiLambdaProps) {
    const functionName = `Nyc311MonitoringApi-${ENV_NAME_SUFFIX[props.envName]}`;

    const logGroup = new logs.LogGroup(scope, `${id}LogGroup`, {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const backendRoot = path.join(__dirname, "..", "..", "backend");

    super(scope, id, {
      functionName,
      entry: path.join(backendRoot, "controller", "web-api", "monitoring", "monitoringApiRouter.ts"),
      handler: "monitoringApiRouter",
      runtime: Runtime.NODEJS_22_X,
      bundling: NYC311_LAMBDA_BUNDLING,
      timeout: Duration.seconds(25),
      memorySize: 256,
      logGroup,
      projectRoot: backendRoot,
      depsLockFilePath: path.join(backendRoot, "package-lock.json"),
      environment: {
        REQUESTS_TABLE_NAME: props.requestsTable.tableName,
        MONITORED_LAMBDA_POLLER: props.pollerFunctionName,
        MONITORED_LAMBDA_ORDER_FAN_OUT: props.orderFanOutFunctionName,
        MONITORED_LAMBDA_REQUEST_EVALUATION: props.requestEvaluationFunctionName,
        MONITORED_LAMBDA_ORDER_EVENT_FAN_OUT: props.orderEventFanOutFunctionName,
        MONITORED_LAMBDA_LOCATIONS_FAN_OUT: props.locationsFanOutFunctionName,
        MONITORED_LAMBDA_OPERATORS_FAN_OUT: props.operatorsFanOutFunctionName,
        MONITORED_LAMBDA_ORDER_EVALUATION: props.orderEvaluationFunctionName,
        MONITORED_LAMBDA_ORDER_SCHEDULING: props.orderSchedulingFunctionName,
        MONITORED_LAMBDA_WAREHOUSE_JOB_RUNNER: props.warehouseJobRunnerFunctionName,
        MONITORED_LAMBDA_ADMIN_API: props.adminApiFunctionName,
        MONITORED_LAMBDA_FEATURE_FLAGS_API: props.featureFlagsApiFunctionName,
        MONITORED_LAMBDA_DATA_API: props.dataApiFunctionName,
        MONITORED_LAMBDA_MONITORING_API: functionName,
        MONITORED_LAMBDA_FLEET_API: props.fleetApiFunctionName,
        MONITORED_LAMBDA_WEBHOOK_SUBSCRIPTIONS_API: props.webhookSubscriptionsApiFunctionName,
        MONITORED_LAMBDA_PIPELINE_STATUS: PIPELINE_STATUS_FUNCTION_NAME,
        MONITORED_LAMBDA_PUBLIC_V1_API: props.publicV1ApiFunctionName,
        PUBLIC_API_ID: props.publicApiId,
      },
    });

    props.requestsTable.grant(this, "dynamodb:Query", "dynamodb:GetItem");
    this.addToRolePolicy(new iam.PolicyStatement({ actions: ["cloudwatch:GetMetricStatistics", "cloudwatch:GetMetricData"], resources: ["*"] }));
  }
}
