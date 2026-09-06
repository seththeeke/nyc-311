import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, it } from "vitest";
import { Nyc311WarehouseBucket } from "../../warehouse/Nyc311WarehouseBucket";

function synth(envName: "TEST" | "PROD"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  new Nyc311WarehouseBucket(stack, "Nyc311WarehouseBucket", { envName });
  return Template.fromStack(stack);
}

describe("Nyc311WarehouseBucket", () => {
  it("is a private, SSE-S3, SSL-only bucket named per environment", () => {
    const t = synth("TEST");
    t.hasResourceProperties("AWS::S3::Bucket", {
      BucketName: "nyc311-warehouse-test",
      BucketEncryption: {
        ServerSideEncryptionConfiguration: [{ ServerSideEncryptionByDefault: { SSEAlgorithm: "AES256" } }],
      },
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
    t.hasResourceProperties("AWS::S3::BucketPolicy", {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([Match.objectLike({ Condition: { Bool: { "aws:SecureTransport": "false" } } })]),
      }),
    });
    synth("PROD").hasResourceProperties("AWS::S3::Bucket", { BucketName: "nyc311-warehouse-prod" });
  });

  it("RETAINs on stack deletion", () => {
    synth("TEST").hasResource("AWS::S3::Bucket", { DeletionPolicy: "Retain" });
  });

  it("has lifecycle rules for data/ (Glacier IR after 180d) and athena-results/ (expire 30d)", () => {
    synth("TEST").hasResourceProperties("AWS::S3::Bucket", {
      LifecycleConfiguration: {
        Rules: Match.arrayWith([
          Match.objectLike({
            Prefix: "data/",
            Transitions: [{ StorageClass: "GLACIER_IR", TransitionInDays: 180 }],
          }),
          Match.objectLike({ Prefix: "athena-results/", ExpirationInDays: 30 }),
        ]),
      },
    });
  });
});
