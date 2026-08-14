import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { Nyc311Stack } from "../../stack/Nyc311Stack";

function synthesize(id: string, envName: "TEST" | "PROD") {
  const app = new App();
  const stack = new Nyc311Stack(app, id, { envName, env: { region: "us-east-1" } });
  return { stack, template: Template.fromStack(stack) };
}

describe("Nyc311Stack", () => {
  it("synthesizes and tags the stack for TEST", () => {
    const { stack, template } = synthesize("TestStack", "TEST");

    // Tags.of(...).add(...) applies via an Aspect, only visited during
    // synthesis — so synthesize (Template.fromStack triggers it) before
    // reading stack.tags back.
    expect(template.toJSON()).toBeDefined();
    expect(stack.tags.tagValues()).toMatchObject({ Environment: "TEST" });
  });

  it("synthesizes and tags the stack for PROD", () => {
    const { stack, template } = synthesize("ProdStack", "PROD");

    expect(template.toJSON()).toBeDefined();
    expect(stack.tags.tagValues()).toMatchObject({ Environment: "PROD" });
  });

  it("wires the Requests table, poller Lambda, and its schedule together (first ingestion slice)", () => {
    const { template } = synthesize("TestStack", "TEST");

    template.resourceCountIs("AWS::DynamoDB::GlobalTable", 1);
    // Not resourceCountIs(1) here — WebsiteHosting's BucketDeployment and
    // autoDeleteObjects each wire their own custom-resource Lambda, so the
    // poller is one of several AWS::Lambda::Function resources in this
    // stack, not the only one.
    template.hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311Poller-Test" });
    template.resourceCountIs("AWS::Scheduler::Schedule", 1);
  });

  it("wires WebsiteHosting (S3 + CloudFront) for web-app/, per claude-prompt-initial.md's hosting decision", () => {
    const { template } = synthesize("TestStack", "TEST");

    template.hasResourceProperties("AWS::S3::Bucket", { BucketName: "nyc311-web-test" });
    template.resourceCountIs("AWS::CloudFront::Distribution", 1);
  });

  it("never exceeds the 10-custom-metric cap (1-data-ingestion.md §8), in either environment", () => {
    expect(
      Object.keys(synthesize("TestStack", "TEST").template.findResources("AWS::Logs::MetricFilter")).length,
    ).toBeLessThanOrEqual(10);
    expect(
      Object.keys(synthesize("ProdStack", "PROD").template.findResources("AWS::Logs::MetricFilter")).length,
    ).toBeLessThanOrEqual(10);
  });
});
