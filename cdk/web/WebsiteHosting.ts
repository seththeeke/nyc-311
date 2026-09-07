import { RemovalPolicy } from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as route53targets from "aws-cdk-lib/aws-route53-targets";
import * as s3 from "aws-cdk-lib/aws-s3";
import type { Construct } from "constructs";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface WebsiteHostingProps {
  envName: Nyc311Environment;
  /** This environment's public site name (8-domain-name-assignment.md §1) — a CloudFront alias + its own ACM cert + Route 53 records. */
  siteDomain: string;
  /** The `boroughsim.com` hosted zone (imported by attributes in Nyc311Stack) — holds the cert-validation and alias records. */
  hostedZone: route53.IHostedZone;
}

/**
 * Static hosting for `web-app/` (S3 + CloudFront, `claude-prompt-initial.md`
 * §5/§7). Origin-access-controlled bucket, 403/404 rewritten to
 * `/index.html` for React Router deep links. Serves on both its custom
 * domain (`siteDomain`) and the CloudFront default `*.cloudfront.net`
 * name. Just the bucket + distribution + DNS — no content deployment;
 * `WebsiteDeployment` does that separately to avoid a circular dependency
 * with `Nyc311Api` (which needs this construct's domain name for CORS).
 */
export class WebsiteHosting extends s3.Bucket {
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: WebsiteHostingProps) {
    const suffix = ENV_NAME_SUFFIX[props.envName];

    /*
     * S3 bucket names are globally unique across all AWS accounts and must
     * be lowercase — CLAUDE.md §5.3's Title-case suffix convention doesn't
     * fit here (and wouldn't even be a legal bucket name); the account ID
     * suffix guarantees uniqueness while the rest keeps the name
     * identifiable at a glance, per that same section's underlying intent.
     */
    const bucketName = `nyc311-web-${suffix.toLowerCase()}`;

    super(scope, id, {
      bucketName,
      /*
       * Holds only rebuildable build output (regenerated from web-app/dist
       * on every deploy), unlike RequestsTable's ingested data — safe to
       * tear down in every environment, including Prod.
       */
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
    });

    /*
     * 8-domain-name-assignment.md §2 — DNS-validated against the hosted
     * zone, so validation records land automatically. Same region as this
     * stack (us-east-1), which is what CloudFront requires; no
     * cross-region cert construct needed.
     */
    const certificate = new acm.Certificate(this, "Certificate", {
      domainName: props.siteDomain,
      validation: acm.CertificateValidation.fromDns(props.hostedZone),
    });

    this.distribution = new cloudfront.Distribution(this, "Distribution", {
      comment: `Nyc311Web-${suffix}`,
      defaultRootObject: "index.html",
      domainNames: [props.siteDomain],
      certificate,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      /*
       * React Router client-side routes (e.g. /monitoring/ingestion) have
       * no matching S3 key, so OAC-fronted S3 returns 403 (404 for a
       * genuinely missing asset) — both rewrite to the SPA shell so the
       * client-side router can take over.
       */
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: "/index.html" },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: "/index.html" },
      ],
    });

    /* Alias A + AAAA at siteDomain → the distribution. */
    const recordTarget = route53.RecordTarget.fromAlias(new route53targets.CloudFrontTarget(this.distribution));
    new route53.ARecord(this, "SiteAliasRecord", {
      zone: props.hostedZone,
      recordName: props.siteDomain,
      target: recordTarget,
    });
    new route53.AaaaRecord(this, "SiteAliasAaaaRecord", {
      zone: props.hostedZone,
      recordName: props.siteDomain,
      target: recordTarget,
    });
  }
}
