import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, it } from "vitest";
import { WebsiteHosting } from "../../web/WebsiteHosting";
import { WebsiteDeployment } from "../../web/WebsiteDeployment";

const API_BASE_URL = "https://xvuarmn9v7.execute-api.us-east-1.amazonaws.com";

function synthesize(): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  const websiteHosting = new WebsiteHosting(stack, "WebsiteHosting", { envName: "TEST" });
  new WebsiteDeployment(stack, "WebsiteDeployment", { websiteHosting, apiBaseUrl: API_BASE_URL });
  return Template.fromStack(stack);
}

describe("WebsiteDeployment", () => {
  it("deploys web-app/dist to the bucket and invalidates the distribution on every deploy", () => {
    const template = synthesize();

    template.resourceCountIs("Custom::CDKBucketDeployment", 1);
    template.hasResourceProperties("Custom::CDKBucketDeployment", {
      DistributionPaths: ["/*"],
    });
  });

  it("stages two sources — web-app/dist and the inline env-config.json — not just one", () => {
    const template = synthesize();

    // Source.asset(distDir) and Source.jsonData("env-config.json", ...)
    // each stage as their own zip asset; two entries here confirms both
    // are wired into the same deployment, not just the dist/ directory.
    template.hasResourceProperties("Custom::CDKBucketDeployment", {
      SourceObjectKeys: Match.arrayWith([Match.stringLikeRegexp(".*\\.zip"), Match.stringLikeRegexp(".*\\.zip")]),
    });
  });
});
