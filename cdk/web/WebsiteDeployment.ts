import * as path from "node:path";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import type { Construct } from "constructs";
import type { WebsiteHosting } from "./WebsiteHosting";
import { ensureDistDirectory } from "./ensureDistDirectory";

export interface WebsiteDeploymentProps {
  websiteHosting: WebsiteHosting;
  /**
   * The public API's base URL, written into `env-config.json` alongside
   * the built SPA. Known only at deploy time, and the pipeline builds
   * `web-app/dist` once for both environments — a Vite build-time env var
   * can't hold two values for one build, so this runtime file is what lets
   * `loadRuntimeConfig` give each environment its own URL.
   */
  apiBaseUrl: string;
}

/**
 * Deploys `web-app/dist` (plus the runtime `env-config.json`) into a
 * `WebsiteHosting` bucket and invalidates its CloudFront distribution.
 * Split out from `WebsiteHosting` itself specifically so it can depend on
 * `Nyc311Api.apiEndpoint` — see `WebsiteHosting.ts`'s doc comment for why
 * that dependency can't live inside `WebsiteHosting` without creating a
 * cycle with `Nyc311Api` (which depends on `WebsiteHosting.distribution`
 * for its own CORS config).
 */
export class WebsiteDeployment extends s3deploy.BucketDeployment {
  constructor(scope: Construct, id: string, props: WebsiteDeploymentProps) {
    const distDir = path.join(__dirname, "..", "..", "web-app", "dist");
    ensureDistDirectory(distDir);

    super(scope, id, {
      sources: [
        s3deploy.Source.asset(distDir),
        s3deploy.Source.jsonData("env-config.json", { apiBaseUrl: props.apiBaseUrl }),
      ],
      destinationBucket: props.websiteHosting,
      distribution: props.websiteHosting.distribution,
      distributionPaths: ["/*"],
    });
  }
}
