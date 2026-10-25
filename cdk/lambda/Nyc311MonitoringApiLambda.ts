import * as path from "node:path";
import { Duration, RemovalPolicy } from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { NYC311_LAMBDA_BUNDLING } from "./lambdaBundling";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";
import type { RequestsTable } from "../data/RequestsTable";
import { monitoredLambdaEnvironment, type Nyc311LambdaMetricsApiLambdaProps } from "./Nyc311LambdaMetricsApiLambda";
import { ENV_NAME_SUFFIX } from "../stack/Nyc311Stack";

export interface Nyc311MonitoringApiLambdaProps extends Nyc311LambdaMetricsApiLambdaProps {
  requestsTable: RequestsTable;
}

/**
 * The monitoring Service API bundle (`15-resource-consolidation.md`
 * §3.3): `GET /ingestion/metrics` and `GET /lambda-metrics`, entry
 * `backend/controller/web-api/monitoring/monitoringApiRouter.ts`. Its
 * timeout is the Lambda-health route's: up to 48 parallel CloudWatch calls.
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
        ...monitoredLambdaEnvironment(props),
      },
    });

    props.requestsTable.grant(this, "dynamodb:Query", "dynamodb:GetItem");
    this.addToRolePolicy(new iam.PolicyStatement({ actions: ["cloudwatch:GetMetricStatistics"], resources: ["*"] }));
  }
}
