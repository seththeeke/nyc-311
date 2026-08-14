import * as path from "node:path";
import { RemovalPolicy } from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import type { Construct } from "constructs";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface WebsiteHostingProps {
  envName: Nyc311Environment;
}

/**
 * Static hosting for `web-app/` (S3 + CloudFront), per
 * `claude-prompt-initial.md` §5/§7 — "Hosting: S3 + CloudFront for the
 * SPA." Origin-access-controlled bucket (no public S3 access; CloudFront
 * is the only reader), 403/404 rewritten to `/index.html` so React
 * Router's client-side routes survive a hard refresh/deep link.
 *
 * `web-app/dist` must exist on disk before this construct is synthesized —
 * `BucketDeployment` stages it as an asset at synth time, the same
 * "cdk/ synth depends on a sibling package's build output already having
 * run" coupling `Nyc311PollerLambda` has with `backend/`, just via a
 * literal pre-built directory instead of `NodejsFunction`'s inline esbuild
 * step (Vite's multi-file bundling can't be inlined the same way). Run
 * `cd web-app && npm run build` first for any local `synth`/`diff`/`deploy`
 * or `cdk/` unit test run; the pipeline's Synth step does this before
 * `cdk/`'s own build+test, for the same reason.
 */
export class WebsiteHosting extends s3.Bucket {
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: WebsiteHostingProps) {
    const suffix = ENV_NAME_SUFFIX[props.envName];

    // S3 bucket names are globally unique across all AWS accounts and must
    // be lowercase — CLAUDE.md §5.3's Title-case suffix convention doesn't
    // fit here (and wouldn't even be a legal bucket name); the account ID
    // suffix guarantees uniqueness while the rest keeps the name
    // identifiable at a glance, per that same section's underlying intent.
    const bucketName = `nyc311-web-${suffix.toLowerCase()}`;

    super(scope, id, {
      bucketName,
      // Holds only rebuildable build output (regenerated from web-app/dist
      // on every deploy), unlike RequestsTable's ingested data — safe to
      // tear down in every environment, including Prod.
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
    });

    const distribution = new cloudfront.Distribution(this, "Distribution", {
      comment: `Nyc311Web-${suffix}`,
      defaultRootObject: "index.html",
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      // React Router client-side routes (e.g. /monitoring/ingestion) have
      // no matching S3 key, so OAC-fronted S3 returns 403 (404 for a
      // genuinely missing asset) — both rewrite to the SPA shell so the
      // client-side router can take over.
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: "/index.html" },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: "/index.html" },
      ],
    });
    this.distribution = distribution;

    new s3deploy.BucketDeployment(this, "Deployment", {
      sources: [s3deploy.Source.asset(path.join(__dirname, "..", "..", "web-app", "dist"))],
      destinationBucket: this,
      distribution,
      distributionPaths: ["/*"],
    });
  }
}
