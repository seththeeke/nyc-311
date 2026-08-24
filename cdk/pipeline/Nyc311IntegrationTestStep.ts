import type { CfnOutput } from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as pipelines from "aws-cdk-lib/pipelines";
import { WEBSITE_HOSTING_TARGETS } from "./websiteHostingTargets";

export type IntegrationTestTarget = "test" | "prod";

export interface IntegrationTestStepProps {
  /** Step id, e.g. "IntegrationTestsTest" — must be unique within the pipeline. */
  id: string;
  target: IntegrationTestTarget;
  /**
   * Test: a failing run fails this action, which fails the DeployTest
   * stage, which blocks DeployProd from starting. Prod: a failing run
   * still gets reported (route-report.json still syncs), but the action
   * itself always exits 0 — same non-blocking pattern ProdDiff already
   * uses (`5-pipeline-integration-tests.md` §5).
   */
  blocking: boolean;
  /** The account the target bucket/distribution live in (for scoping the invalidation IAM statement). */
  account: string;
  /** That environment's Nyc311Stack.apiUrlOutput (via Nyc311AppStage) — wired in as API_BASE_URL, not hardcoded (the URL isn't deterministic). */
  apiUrlOutput: CfnOutput;
  /** Reused from the pipeline's own source, so backend/ is present in this step's workspace. */
  source: pipelines.CodePipelineSource;
}

/**
 * A post-deploy step (`5-pipeline-integration-tests.md` §5) that runs
 * `backend/tests/integration/`'s real-HTTP GET-route suite against that
 * environment's live API, then syncs `route-report.json` to that
 * environment's website bucket under `/integration-tests/` and
 * invalidates CloudFront — regardless of pass/fail, so a failing run's
 * report stays visible. A `post` step on `DeployTest`/`DeployProd`, so it
 * never runs before that stage's deploy has created the target
 * bucket/distribution/API.
 */
export function createIntegrationTestStep(props: IntegrationTestStepProps): pipelines.CodeBuildStep {
  const { bucketName, distributionId } = WEBSITE_HOSTING_TARGETS[props.target === "test" ? "TEST" : "PROD"];

  /*
   * The test run's exit code is captured to a file, not checked directly,
   * so the sync/invalidate commands below always run next regardless of
   * pass/fail — only the final `exit` (blocking only) fails this action.
   * `cd ..` is required, not decorative — CodeBuild's `commands` share
   * one shell, so cwd persists across entries; without it, the paths
   * below resolve against `backend/backend/...` (a real run once failed
   * exactly this way).
   */
  const runAndCaptureExit = `cd backend && npm ci && (npm run test:integration:${props.target}; echo $? > /tmp/integration-test-exit-code) && cd ..`;
  const syncReport = `aws s3 cp backend/tests/integration/reports/route-report.json s3://${bucketName}/integration-tests/route-report.json`;
  const invalidate = `aws cloudfront create-invalidation --distribution-id ${distributionId} --paths "/integration-tests/*"`;
  const finish = props.blocking ? "exit $(cat /tmp/integration-test-exit-code)" : "exit 0";

  return new pipelines.CodeBuildStep(props.id, {
    input: props.source,
    envFromCfnOutputs: { API_BASE_URL: props.apiUrlOutput },
    commands: [runAndCaptureExit, syncReport, invalidate, finish],
    /*
     * Least-privilege, not a blanket bucket grant: this step can write
     * under /integration-tests/* only, never touch the SPA's own files
     * or the coverage report at the bucket root/other prefixes, and can
     * only invalidate this one distribution.
     */
    rolePolicyStatements: [
      new iam.PolicyStatement({
        sid: "ListIntegrationTestReportBucket",
        actions: ["s3:ListBucket"],
        resources: [`arn:aws:s3:::${bucketName}`],
      }),
      new iam.PolicyStatement({
        sid: "WriteIntegrationTestReportObjects",
        actions: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
        resources: [`arn:aws:s3:::${bucketName}/integration-tests/*`],
      }),
      new iam.PolicyStatement({
        sid: "InvalidateIntegrationTestReportPaths",
        actions: ["cloudfront:CreateInvalidation"],
        resources: [`arn:aws:cloudfront::${props.account}:distribution/${distributionId}`],
      }),
    ],
  });
}
