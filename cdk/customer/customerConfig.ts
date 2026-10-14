import type { BundlingOptions } from "aws-cdk-lib/aws-lambda-nodejs";

/*
 * Constants for the customer stack (13-customer-simulation.md). Anything
 * the bureau also defines is copied here, never imported — cdk/customer/
 * imports no bureau construct directory (CLAUDE.md §5.3).
 */

/* The customer exists once, against Prod; its resources keep the suffix for uniformity. */
export const CUSTOMER_ENV_SUFFIX = "Prod";
export const CUSTOMER_STACK_NAME = "Nyc311Customer-Prod";

/* The one resource shared with the bureau: a record in this hosted zone. Same pinned id as stack/Nyc311Stack.ts. */
export const CUSTOMER_ROOT_DOMAIN = "boroughsim.com";
export const CUSTOMER_HOSTED_ZONE_ID = "Z014904580HQD5MMLQWU";
export const CUSTOMER_API_DOMAIN = "customer-api.boroughsim.com";

/* Where the bureau delivers lifecycle events — the callback URL the customer registers. */
export const CUSTOMER_WEBHOOK_PATH = "/webhooks/bureau";

/* The customer's signing secret, a SecureString created by hand at launch (the doc's Appendix I). Outside the bureau's own prefix. */
export const CUSTOMER_SIGNING_SECRET_PARAMETER_NAME = "/customer/prod/webhook/signing-secret";

/* Same esbuild options the bureau's Lambdas use: minified, names kept. */
export const CUSTOMER_LAMBDA_BUNDLING: BundlingOptions = {
  minify: true,
  keepNames: true,
};
