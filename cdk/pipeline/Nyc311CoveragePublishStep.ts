import * as iam from "aws-cdk-lib/aws-iam";
import * as pipelines from "aws-cdk-lib/pipelines";

/*
 * hosting-test-coverage.md §2.3 — deterministic bucket names and
 * effectively-permanent distribution IDs, hardcoded the same way
 * Nyc311PipelineStatusApi.ts hardcodes TEST_WEB_DOMAIN/PROD_WEB_DOMAIN
 * rather than reaching cross-stack into WebsiteHosting. Confirmed via
 * `aws s3 ls`/`aws cloudfront list-distributions --profile nyc311`;
 * update by hand alongside those two constants if WebsiteHosting is ever
 * recreated.
 */
export const COVERAGE_PUBLISH_TARGETS = {
  TEST: { bucketName: "nyc311-web-test", distributionId: "E1EFLKB8JSXGXU" },
  PROD: { bucketName: "nyc311-web-prod", distributionId: "E1FXE4OBQCY52G" },
} as const;

/* hosting-test-coverage.md §2.1/§2.2 — the three packages' coverage/ output, captured off Synth as additional FileSets. */
const COVERAGE_PACKAGE_DIRS = ["backend/coverage", "cdk/coverage", "web-app/coverage"];

export interface CoveragePublishStepProps {
  /** Step id, e.g. "PublishCoverageTest" — must be unique within the pipeline. */
  id: string;
  /** The account the target bucket/distribution live in (for scoping the invalidation IAM statement). */
  account: string;
  bucketName: string;
  distributionId: string;
  /** Reused from the pipeline's own source, so `scripts/` is present in this step's workspace. */
  source: pipelines.CodePipelineSource;
  /** The pipeline's Synth step — coverage/ directories are captured off it via `addOutputDirectory`. */
  synth: pipelines.ShellStep;
}

/**
 * A post-deploy step (`hosting-test-coverage.md` §2.2/§3) that merges the
 * three packages' Vitest coverage runs into one Istanbul-merged HTML
 * report (`scripts/publish-coverage.js`) and syncs it to that
 * environment's own website bucket under `/coverage/`, then invalidates
 * CloudFront so the refreshed report is immediately visible. Added as a
 * `post` step on a `DeployTest`/`DeployProd` stage — never runs before
 * that stage's `Nyc311Stack` deploy has already created the target
 * bucket/distribution.
 */
export function createCoveragePublishStep(props: CoveragePublishStepProps): pipelines.CodeBuildStep {
  const additionalInputs: Record<string, pipelines.FileSet> = {};
  for (const dir of COVERAGE_PACKAGE_DIRS) {
    additionalInputs[dir] = props.synth.addOutputDirectory(dir);
  }

  return new pipelines.CodeBuildStep(props.id, {
    input: props.source,
    additionalInputs,
    commands: [
      /* Root-level devDependencies (istanbul-lib-*) back scripts/publish-coverage.js's coverage-map merge — not installed by Synth's per-package `npm ci`s. */
      "npm ci",
      "node scripts/publish-coverage.js",
      `aws s3 sync coverage-publish/ s3://${props.bucketName}/coverage/ --delete`,
      `aws cloudfront create-invalidation --distribution-id ${props.distributionId} --paths "/coverage/*"`,
    ],
    /*
     * Least-privilege, not a blanket bucket grant: this step can write
     * under /coverage/* only, never touch the SPA's own files at the
     * bucket root, and can only invalidate this one distribution.
     */
    rolePolicyStatements: [
      new iam.PolicyStatement({
        sid: "ListCoverageBucket",
        actions: ["s3:ListBucket"],
        resources: [`arn:aws:s3:::${props.bucketName}`],
      }),
      new iam.PolicyStatement({
        sid: "WriteCoverageObjects",
        actions: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
        resources: [`arn:aws:s3:::${props.bucketName}/coverage/*`],
      }),
      new iam.PolicyStatement({
        sid: "InvalidateCoveragePaths",
        actions: ["cloudfront:CreateInvalidation"],
        resources: [`arn:aws:cloudfront::${props.account}:distribution/${props.distributionId}`],
      }),
    ],
  });
}
