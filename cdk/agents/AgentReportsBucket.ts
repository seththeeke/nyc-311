import { Duration, RemovalPolicy, Stack } from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import type { Construct } from "constructs";

/** The reports bucket's name in an account: account-level, so no env suffix (docs/17-executive-team.md §19.6). */
export function agentReportsBucketName(account: string): string {
  return `nyc311-agent-reports-${account}`;
}

/**
 * Agent reports published for the website (docs/17-executive-team.md
 * §19.6): one bucket per account, written by an agent's sync after its run
 * (`scripts/agent-reports-sync.sh`), read by the monitoring API in Test and
 * Prod alike. Private: no public access, TLS only. The reports are also
 * committed to the repo, so the bucket is a copy; it is retained anyway.
 */
export class AgentReportsBucket extends s3.Bucket {
  constructor(scope: Construct, id: string) {
    super(scope, id, {
      bucketName: agentReportsBucketName(Stack.of(scope).account),
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.RETAIN,
      lifecycleRules: [{ abortIncompleteMultipartUploadAfter: Duration.days(1) }],
    });
  }
}
