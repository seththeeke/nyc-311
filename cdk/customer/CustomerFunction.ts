import * as path from "node:path";
import { type Duration, RemovalPolicy } from "aws-cdk-lib";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";
import { CUSTOMER_BACKEND_ROOT } from "./customerBackendRoot";
import { CUSTOMER_ENV_SUFFIX, CUSTOMER_LAMBDA_BUNDLING } from "./customerConfig";

export interface CustomerFunctionProps {
  /** Without the `-Prod` suffix, e.g. `CustomerIdeaWorker`. */
  name: string;
  /** Path segments under the customer package, e.g. `["controller", "idea", "generateIdeaController.ts"]`. */
  entry: string[];
  handler: string;
  timeout: Duration;
  memorySize: number;
  environment: Record<string, string>;
}

/**
 * Shared shape for the customer's Lambdas: the customer package's own
 * code and lock file, Node 22, a suffixed name and a one-month,
 * disposable log group. Each Lambda is still its own construct.
 */
export class CustomerFunction extends NodejsFunction {
  constructor(scope: Construct, id: string, props: CustomerFunctionProps) {
    const functionName = `${props.name}-${CUSTOMER_ENV_SUFFIX}`;
    const logGroup = new logs.LogGroup(scope, `${id}LogGroup`, {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    super(scope, id, {
      functionName,
      entry: path.join(CUSTOMER_BACKEND_ROOT, ...props.entry),
      handler: props.handler,
      runtime: Runtime.NODEJS_22_X,
      bundling: CUSTOMER_LAMBDA_BUNDLING,
      timeout: props.timeout,
      memorySize: props.memorySize,
      logGroup,
      projectRoot: CUSTOMER_BACKEND_ROOT,
      depsLockFilePath: path.join(CUSTOMER_BACKEND_ROOT, "package-lock.json"),
      environment: props.environment,
    });
  }
}
