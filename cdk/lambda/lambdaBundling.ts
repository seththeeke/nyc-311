import type { BundlingOptions } from "aws-cdk-lib/aws-lambda-nodejs";

/*
 * Shared esbuild options for every NodejsFunction in the app. Minified to
 * shrink Lambda bundles (AWS SDK client code is otherwise inlined unminified).
 * keepNames preserves function/class names so any name-based logic still holds.
 */
export const NYC311_LAMBDA_BUNDLING: BundlingOptions = {
  minify: true,
  keepNames: true,
};
