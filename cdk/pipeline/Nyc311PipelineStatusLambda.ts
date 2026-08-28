import * as path from "node:path";
import { Duration } from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";

/* Exported so Nyc311LambdaMetricsApiLambda (a different stack) can reference this Lambda by name without a cross-stack construct reference. */
export const PIPELINE_STATUS_FUNCTION_NAME = "Nyc311PipelineStatus";

export interface Nyc311PipelineStatusLambdaProps {
  /** The pipeline's own name (e.g. "Nyc311Pipeline") — passed as an env var rather than hardcoded a second time in application code. */
  pipelineName: string;
  /** The underlying `codepipeline.Pipeline` L2's ARN, for least-privilege IAM scoping (never `*`). */
  pipelineArn: string;
}

/**
 * Backs `GET /pipeline/status` (2-pipeline-monitoring.md). Unlike every
 * other Lambda here, lives in `Nyc311PipelineStack` (a singleton) since
 * the pipeline it reports on is itself a singleton — no `ENV_NAME_SUFFIX`.
 * Read-only: grants exactly the three CodePipeline actions the service
 * layer calls, scoped to this pipeline's own ARN.
 */
export class Nyc311PipelineStatusLambda extends NodejsFunction {
  constructor(scope: Construct, id: string, props: Nyc311PipelineStatusLambdaProps) {
    const functionName = PIPELINE_STATUS_FUNCTION_NAME;

    const logGroup = new logs.LogGroup(scope, `${id}LogGroup`, {
      logGroupName: `/aws/lambda/${functionName}`, /* matches Lambda's own default log group naming convention */
      retention: logs.RetentionDays.ONE_MONTH,
    });

    const backendRoot = path.join(__dirname, "..", "..", "backend");

    super(scope, id, {
      functionName,
      entry: path.join(backendRoot, "controller", "web-api", "getPipelineStatusController.ts"),
      handler: "getPipelineStatusController",
      runtime: Runtime.NODEJS_22_X,
      timeout: Duration.seconds(20), /* up to ~1 + 1 + 10*2 CodePipeline calls per invocation, mostly parallelized (service §3) */
      memorySize: 256,
      logGroup,
      /*
       * backend/ is its own npm package (own lockfile/node_modules),
       * separate from cdk/ — see Nyc311PollerLambda for the same note.
       */
      projectRoot: backendRoot,
      depsLockFilePath: path.join(backendRoot, "package-lock.json"),
      environment: {
        PIPELINE_NAME: props.pipelineName,
      },
    });

    this.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "codepipeline:GetPipelineState",
          "codepipeline:ListPipelineExecutions",
          "codepipeline:GetPipelineExecution",
          "codepipeline:ListActionExecutions",
        ],
        resources: [props.pipelineArn],
      })
    );
  }
}
