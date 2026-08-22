import * as path from "node:path";
import { Duration } from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";
import { PIPELINE_STATUS_FUNCTION_NAME } from "../pipeline/Nyc311PipelineStatusLambda";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311LambdaMetricsApiLambdaProps {
  envName: Nyc311Environment;
  /** Physical function names of every Lambda this stack owns that the health tile should cover. */
  pollerFunctionName: string;
  orderFanOutFunctionName: string;
  requestEvaluationFunctionName: string;
  metricsApiFunctionName: string;
  ordersApiFunctionName: string;
}

/**
 * Backs the public `GET /lambda-metrics` route (Lambda health tile, added
 * after the 2026-08-22 fan-out-Lambda incident) — entry point is
 * `getLambdaMetricsController.ts`. Grants only `cloudwatch:GetMetricStatistics`;
 * `Resource: "*"` is unavoidable since CloudWatch metrics aren't
 * ARN-addressable. Monitored-Lambda list is static
 * (`lambdaMetricsService.ts`'s `MONITORED_LAMBDAS`); `Nyc311PipelineStatus`
 * is a fixed literal since it lives in a separate stack.
 */
export class Nyc311LambdaMetricsApiLambda extends NodejsFunction {
  constructor(scope: Construct, id: string, props: Nyc311LambdaMetricsApiLambdaProps) {
    const functionName = `Nyc311LambdaMetricsApi-${ENV_NAME_SUFFIX[props.envName]}`;

    const logGroup = new logs.LogGroup(scope, `${id}LogGroup`, {
      logGroupName: `/aws/lambda/${functionName}`, /* matches Lambda's own default log group naming convention */
      retention: logs.RetentionDays.ONE_MONTH,
    });

    const backendRoot = path.join(__dirname, "..", "..", "backend");

    super(scope, id, {
      functionName,
      entry: path.join(backendRoot, "controller", "web-api", "getLambdaMetricsController.ts"),
      handler: "getLambdaMetricsController",
      runtime: Runtime.NODEJS_22_X,
      timeout: Duration.seconds(15), /* up to 12 parallel CloudWatch calls (6 monitored lambdas x 2 metrics) per invocation */
      memorySize: 256,
      logGroup,
      /*
       * backend/ is its own npm package (own lockfile/node_modules),
       * separate from cdk/ — see Nyc311PollerLambda for the same note.
       */
      projectRoot: backendRoot,
      depsLockFilePath: path.join(backendRoot, "package-lock.json"),
      environment: {
        MONITORED_LAMBDA_POLLER: props.pollerFunctionName,
        MONITORED_LAMBDA_ORDER_FAN_OUT: props.orderFanOutFunctionName,
        MONITORED_LAMBDA_REQUEST_EVALUATION: props.requestEvaluationFunctionName,
        MONITORED_LAMBDA_METRICS_API: props.metricsApiFunctionName,
        MONITORED_LAMBDA_ORDERS_API: props.ordersApiFunctionName,
        MONITORED_LAMBDA_PIPELINE_STATUS: PIPELINE_STATUS_FUNCTION_NAME,
      },
    });

    this.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["cloudwatch:GetMetricStatistics"],
        resources: ["*"],
      })
    );
  }
}
