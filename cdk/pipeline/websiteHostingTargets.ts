/*
 * Deterministic bucket names / CloudFront distribution IDs per
 * environment, hardcoded like Nyc311PipelineStatusApi.ts's
 * TEST_WEB_DOMAIN/PROD_WEB_DOMAIN — update by hand if WebsiteHosting is
 * ever recreated. Shared by every step publishing onto a WebsiteHosting
 * bucket under its own prefix (hosting-test-coverage.md §2.3,
 * 5-pipeline-integration-tests.md §5).
 */
export const WEBSITE_HOSTING_TARGETS = {
  TEST: { bucketName: "nyc311-web-test", distributionId: "E1EFLKB8JSXGXU" },
  PROD: { bucketName: "nyc311-web-prod", distributionId: "E1FXE4OBQCY52G" },
} as const;
