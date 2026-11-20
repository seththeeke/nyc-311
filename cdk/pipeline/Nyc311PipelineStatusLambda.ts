import { Duration } from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import type { Construct } from "constructs";
import { Nyc311Function } from "../lambda/Nyc311Function";

/* Exported so Nyc311MonitoringApiLambda (a different stack) can reference this Lambda by name without a cross-stack construct reference. */
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
export class Nyc311PipelineStatusLambda extends Nyc311Function {
  constructor(scope: Construct, id: string, props: Nyc311PipelineStatusLambdaProps) {
    super(scope, id, {
      envName: null,
      name: PIPELINE_STATUS_FUNCTION_NAME,
      entry: ["controller", "web-api", "getPipelineStatusController.ts"],
      handler: "getPipelineStatusController",
      timeout: Duration.seconds(20), /* up to ~1 + 1 + 10*2 CodePipeline calls per invocation, mostly parallelized (service §3) */
      memorySize: 256,
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
