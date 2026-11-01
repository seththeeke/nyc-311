import type { BundlingOptions } from "aws-cdk-lib/aws-lambda-nodejs";

/*
 * Constants for the customer stack (13-customer-simulation.md). Anything
 * BoroughSim also defines is copied here, never imported — cdk/customer/
 * imports no BoroughSim construct directory (CLAUDE.md §5.3).
 */

/* The customer exists once, against Prod; its resources keep the suffix for uniformity. */
export const CUSTOMER_ENV_SUFFIX = "Prod";
export const CUSTOMER_STACK_NAME = "Nyc311Customer-Prod";

/* The one resource shared with BoroughSim: a record in this hosted zone. Same pinned id as stack/Nyc311Stack.ts. */
export const CUSTOMER_ROOT_DOMAIN = "boroughsim.com";
export const CUSTOMER_HOSTED_ZONE_ID = "Z014904580HQD5MMLQWU";
export const CUSTOMER_API_DOMAIN = "customer-api.boroughsim.com";

/* Where BoroughSim delivers lifecycle events — the callback URL the customer registers. */
/*
 * Registered on BoroughSim's live Prod subscription, so it keeps its
 * original name; renaming it means a new subscription (docs/99-things-to-come-back-to.md).
 */
export const CUSTOMER_WEBHOOK_PATH = "/webhooks/bureau";

/* The customer's signing secret, a SecureString created by hand at launch (the doc's Appendix I). Outside BoroughSim's own prefix. */
export const CUSTOMER_SIGNING_SECRET_PARAMETER_NAME = "/customer/prod/webhook/signing-secret";

/* Who may read the resident API from a browser: BoroughSim's two sites and the local dev server. */
export const CUSTOMER_API_ALLOWED_ORIGINS = ["https://boroughsim.com", "https://test.boroughsim.com", "http://localhost:5173"];

/* The public read routes (13-customer-simulation.md §4, Appendix K), all served by one Lambda. */
export const CUSTOMER_READ_ROUTES = [
  "/residents",
  "/residents/{personaId}",
  "/residents/{personaId}/ideas",
  "/residents/{personaId}/ideas/{ideaId}",
  "/ideas",
];

/* BoroughSim's public API, which residents' tools call like any outside client (docs/16-resident-action-models.md §5.1). */
export const CUSTOMER_PUBLIC_API_BASE_URL = "https://public-api.boroughsim.com";

/* Same esbuild options BoroughSim's Lambdas use: minified, names kept. */
export const CUSTOMER_LAMBDA_BUNDLING: BundlingOptions = {
  minify: true,
  keepNames: true,
};
