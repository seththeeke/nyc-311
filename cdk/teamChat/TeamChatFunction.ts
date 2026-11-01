import * as path from "node:path";
import { type Duration, RemovalPolicy } from "aws-cdk-lib";
import { Runtime, Tracing } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";
import { NYC311_LAMBDA_BUNDLING } from "../lambda/lambdaBundling";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export const BACKEND_ROOT = path.join(__dirname, "..", "..", "backend");

export interface TeamChatFunctionProps {
  envName: Nyc311Environment;
  /** Without the env suffix, e.g. `TeamChatApi`. */
  name: string;
  /** Path segments under backend/, e.g. `["controller", "web-api", "teamChat", "teamChatApiRouter.ts"]`. */
  entry: string[];
  handler: string;
  timeout: Duration;
  memorySize: number;
  environment: Record<string, string>;
}

/** A backend/ Lambda in the Team Chat stack, named and logged per environment. */
export class TeamChatFunction extends NodejsFunction {
  constructor(scope: Construct, id: string, props: TeamChatFunctionProps) {
    const functionName = `${props.name}-${ENV_NAME_SUFFIX[props.envName]}`;
    const logGroup = new logs.LogGroup(scope, `${id}LogGroup`, {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    super(scope, id, {
      functionName,
      entry: path.join(BACKEND_ROOT, ...props.entry),
      handler: props.handler,
      runtime: Runtime.NODEJS_22_X,
      bundling: NYC311_LAMBDA_BUNDLING,
      timeout: props.timeout,
      memorySize: props.memorySize,
      tracing: Tracing.ACTIVE,
      logGroup,
      projectRoot: BACKEND_ROOT,
      depsLockFilePath: path.join(BACKEND_ROOT, "package-lock.json"),
      environment: props.environment,
    });
  }
}
