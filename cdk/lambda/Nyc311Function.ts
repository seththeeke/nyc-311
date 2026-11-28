import * as path from "node:path";
import { type Duration, RemovalPolicy } from "aws-cdk-lib";
import { Runtime, Tracing } from "aws-cdk-lib/aws-lambda";
import { type ICommandHooks, NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";
import { NYC311_LAMBDA_BUNDLING } from "./lambdaBundling";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

/*
 * backend/ is its own npm package with its own lockfile. NodejsFunction's
 * default projectRoot detection walks up from cdk/ and rejects an entry
 * outside it, so projectRoot and depsLockFilePath both point here.
 */
export const NYC311_BACKEND_ROOT = path.join(__dirname, "..", "..", "backend");

export interface Nyc311FunctionProps {
  /** `null` only for a Lambda in a singleton stack (`Nyc311PipelineStack`): its name gets no env suffix. */
  envName: Nyc311Environment | null;
  /** Without the env suffix, e.g. `Nyc311Poller`. */
  name: string;
  /** Path segments under backend/, e.g. `["controller", "ingestion", "nyc311PollerController.ts"]`. */
  entry: string[];
  handler: string;
  timeout: Duration;
  memorySize: number;
  environment: Record<string, string>;
  /** Active X-Ray tracing. Off unless a Lambda opts in. */
  tracing?: boolean;
  /** esbuild hooks added to the shared bundling, e.g. to copy a non-TS asset in. */
  commandHooks?: ICommandHooks;
}

/**
 * Every backend/ Lambda, named and logged per environment (#218). Fleet-wide settings live here once: Node 22, shared bundling,
 * a one-month log group that is destroyed with the stack (a retained
 * group with a fixed name blocks re-creating it), and tracing off by
 * default.
 */
export class Nyc311Function extends NodejsFunction {
  public readonly functionLogGroup: logs.LogGroup;

  constructor(scope: Construct, id: string, props: Nyc311FunctionProps) {
    const functionName = props.envName === null ? props.name : `${props.name}-${ENV_NAME_SUFFIX[props.envName]}`;
    const logGroup = new logs.LogGroup(scope, `${id}LogGroup`, {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    super(scope, id, {
      functionName,
      entry: path.join(NYC311_BACKEND_ROOT, ...props.entry),
      handler: props.handler,
      runtime: Runtime.NODEJS_22_X,
      bundling: props.commandHooks ? { ...NYC311_LAMBDA_BUNDLING, commandHooks: props.commandHooks } : NYC311_LAMBDA_BUNDLING,
      timeout: props.timeout,
      memorySize: props.memorySize,
      tracing: props.tracing ? Tracing.ACTIVE : undefined,
      logGroup,
      projectRoot: NYC311_BACKEND_ROOT,
      depsLockFilePath: path.join(NYC311_BACKEND_ROOT, "package-lock.json"),
      environment: props.environment,
    });
    this.functionLogGroup = logGroup;
  }
}
