import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import * as route53 from "aws-cdk-lib/aws-route53";
import { describe, it } from "vitest";
import { WebsiteHosting } from "../../web/WebsiteHosting";

const SITE_DOMAIN_BY_ENV = { TEST: "test.boroughsim.com", PROD: "boroughsim.com" } as const;

function synthesize(envName: "TEST" | "PROD"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  const hostedZone = route53.PublicHostedZone.fromHostedZoneAttributes(stack, "HostedZone", {
    hostedZoneId: "Z0123456789ABCDEFGHIJ",
    zoneName: "boroughsim.com",
  });
  new WebsiteHosting(stack, "WebsiteHosting", { envName, siteDomain: SITE_DOMAIN_BY_ENV[envName], hostedZone });
  return Template.fromStack(stack);
}

describe("WebsiteHosting", () => {
  it("suffixes the bucket name by environment, lowercase, distinguishing Test from Prod at a glance", () => {
    synthesize("TEST").hasResourceProperties("AWS::S3::Bucket", { BucketName: "nyc311-web-test" });
    synthesize("PROD").hasResourceProperties("AWS::S3::Bucket", { BucketName: "nyc311-web-prod" });
  });

  it("blocks all public access on the bucket — CloudFront (via OAC) is the only reader", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::S3::Bucket", {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
  });

  it("uses DESTROY removal policy with auto-delete — rebuildable static assets, not ingested data", () => {
    const template = synthesize("TEST");

    template.hasResource("AWS::S3::Bucket", { DeletionPolicy: "Delete" });
    /*
     * autoDeleteObjects wires a custom-resource Lambda that empties the
     * bucket pre-delete — its presence confirms the option took effect.
     */
    template.resourceCountIs("Custom::S3AutoDeleteObjects", 1);
  });

  it("fronts the bucket with a CloudFront distribution using Origin Access Control", () => {
    const template = synthesize("TEST");

    template.resourceCountIs("AWS::CloudFront::OriginAccessControl", 1);
    template.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: Match.objectLike({
        DefaultRootObject: "index.html",
        Comment: "Nyc311Web-Test",
      }),
    });
  });

  it("rewrites 403/404 to /index.html with a 200 so client-side routes survive a deep link", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: Match.objectLike({
        CustomErrorResponses: Match.arrayWith([
          Match.objectLike({ ErrorCode: 403, ResponseCode: 200, ResponsePagePath: "/index.html" }),
          Match.objectLike({ ErrorCode: 404, ResponseCode: 200, ResponsePagePath: "/index.html" }),
        ]),
      }),
    });
  });

  it("attaches the custom domain as a CloudFront alias with a DNS-validated ACM cert", () => {
    const template = synthesize("PROD");

    template.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: Match.objectLike({
        Aliases: ["boroughsim.com"],
        ViewerCertificate: Match.objectLike({ SslSupportMethod: "sni-only" }),
      }),
    });
    template.hasResourceProperties("AWS::CertificateManager::Certificate", {
      DomainName: "boroughsim.com",
      ValidationMethod: "DNS",
    });
  });

  it("creates A and AAAA alias records for the site domain in the hosted zone", () => {
    const template = synthesize("PROD");

    template.hasResourceProperties("AWS::Route53::RecordSet", {
      Name: "boroughsim.com.",
      Type: "A",
      HostedZoneId: "Z0123456789ABCDEFGHIJ",
    });
    template.hasResourceProperties("AWS::Route53::RecordSet", { Name: "boroughsim.com.", Type: "AAAA" });
  });

  it("deploys no content itself — that's WebsiteDeployment's job (see its own tests)", () => {
    const template = synthesize("TEST");

    template.resourceCountIs("Custom::CDKBucketDeployment", 0);
  });
});
