import * as path from "node:path";
import { Duration } from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";

export interface Nyc311PipelineStatusLambdaProps {
  /** The pipeline's own name (e.g. "Nyc311Pipeline") — passed as an env var rather than hardcoded a second time in application code. */
  pipelineName: string;
  /** The underlying `codepipeline.Pipeline` L2's ARN, for least-privilege IAM scoping (never `*`). */
  pipelineArn: string;
}

/**
 * Backs the public `GET /pipeline/status` route
 * (2-pipeline-monitoring.md) — entry point is
 * `backend/controller/web-api/getPipelineStatusController.ts`. Unlike
 * every other Lambda in this project, this one lives in
 * `Nyc311PipelineStack` (a singleton, not deployed per-environment) since
 * the pipeline it reports on is itself a singleton — see
 * `2-pipeline-monitoring.md` §2. No `ENV_NAME_SUFFIX` treatment: there is
 * only ever one of this stack.
 *
 * Read-only: grants exactly the three CodePipeline actions the service
 * layer calls (`GetPipelineState`/`ListPipelineExecutions`/
 * `GetPipelineExecution`), scoped to this pipeline's own ARN — nothing
 * broader, and nothing that can mutate the pipeline.
 */
export class Nyc311PipelineStatusLambda extends NodejsFunction {
  constructor(scope: Construct, id: string, props: Nyc311PipelineStatusLambdaProps) {
    const functionName = "Nyc311PipelineStatus";

    const logGroup = new logs.LogGroup(scope, `${id}LogGroup`, {
      logGroupName: `/aws/lambda/${functionName}`, // matches Lambda's own default log group naming convention
      retention: logs.RetentionDays.ONE_MONTH,
    });

    const backendRoot = path.join(__dirname, "..", "..", "backend");

    super(scope, id, {
      functionName,
      entry: path.join(backendRoot, "controller", "web-api", "getPipelineStatusController.ts"),
      handler: "getPipelineStatusController",
      runtime: Runtime.NODEJS_22_X,
      timeout: Duration.seconds(15), // up to ~1 + 1 + 10 sequential-ish CodePipeline calls per invocation (service §3)
      memorySize: 256,
      logGroup,
      // backend/ is its own npm package (own lockfile/node_modules),
      // separate from cdk/ — see Nyc311PollerLambda for the same note.
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
        ],
        resources: [props.pipelineArn],
      })
    );
  }
}
