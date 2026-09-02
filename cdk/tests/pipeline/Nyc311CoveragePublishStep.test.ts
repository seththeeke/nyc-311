import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { beforeAll, describe, expect, it } from "vitest";
import { Nyc311PipelineStack } from "../../pipeline/Nyc311PipelineStack";

const TEST_ENV = { account: "178280182163", region: "us-east-1" };

/*
 * Synthesizing the full pipeline stack is ~3.4s of CPU; doing it once per
 * `it` (as this file used to) is pure waste — every assertion below is a
 * read-only Template query. Synthesize once, share the Template. Same
 * reasoning as tests/stack/Nyc311Stack.test.ts's beforeAll.
 */
let template: Template;

beforeAll(() => {
  const app = new App();
  const stack = new Nyc311PipelineStack(app, "TestPipelineStack", { env: TEST_ENV });
  template = Template.fromStack(stack);
});

describe("Nyc311CoveragePublishStep", () => {
  it("stages and syncs coverage to the Test website bucket, then invalidates its distribution", () => {
    template.hasResourceProperties("AWS::CodeBuild::Project", {
      Source: Match.objectLike({
        BuildSpec: Match.stringLikeRegexp(
          "npm ci[\\s\\S]*node scripts/publish-coverage\\.js[\\s\\S]*aws s3 sync coverage-publish/ s3://nyc311-web-test/coverage/ --delete[\\s\\S]*aws cloudfront create-invalidation --distribution-id E1EFLKB8JSXGXU --paths \\\\\"/coverage/\\*\\\\\"",
        ),
      }),
    });
  });

  it("stages and syncs coverage to the Prod website bucket, then invalidates its distribution", () => {
    template.hasResourceProperties("AWS::CodeBuild::Project", {
      Source: Match.objectLike({
        BuildSpec: Match.stringLikeRegexp(
          "npm ci[\\s\\S]*node scripts/publish-coverage\\.js[\\s\\S]*aws s3 sync coverage-publish/ s3://nyc311-web-prod/coverage/ --delete[\\s\\S]*aws cloudfront create-invalidation --distribution-id E1FXE4OBQCY52G --paths \\\\\"/coverage/\\*\\\\\"",
        ),
      }),
    });
  });

  it("scopes the Test publish role to only /coverage/* on that one bucket, and that one distribution's invalidation", () => {
    template.hasResourceProperties("AWS::IAM::Policy", {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({ Sid: "ListCoverageBucket", Resource: "arn:aws:s3:::nyc311-web-test" }),
          Match.objectLike({
            Sid: "WriteCoverageObjects",
            Resource: "arn:aws:s3:::nyc311-web-test/coverage/*",
          }),
          Match.objectLike({
            Sid: "InvalidateCoveragePaths",
            Action: "cloudfront:CreateInvalidation",
            Resource: "arn:aws:cloudfront::178280182163:distribution/E1EFLKB8JSXGXU",
          }),
        ]),
      }),
    });
  });

  it("scopes the Prod publish role the same way, to nyc311-web-prod and its own distribution", () => {
    template.hasResourceProperties("AWS::IAM::Policy", {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({ Sid: "ListCoverageBucket", Resource: "arn:aws:s3:::nyc311-web-prod" }),
          Match.objectLike({
            Sid: "WriteCoverageObjects",
            Resource: "arn:aws:s3:::nyc311-web-prod/coverage/*",
          }),
          Match.objectLike({
            Sid: "InvalidateCoveragePaths",
            Action: "cloudfront:CreateInvalidation",
            Resource: "arn:aws:cloudfront::178280182163:distribution/E1FXE4OBQCY52G",
          }),
        ]),
      }),
    });
  });

  it("never grants a wildcard resource on either publish role's coverage-object statement", () => {
    const policies = Object.values(template.findResources("AWS::IAM::Policy")) as {
      Properties: { PolicyDocument: { Statement: { Sid?: string; Resource: string | string[] }[] } };
    }[];
    const coveragePolicies = policies.filter((policy) =>
      policy.Properties.PolicyDocument.Statement.some((statement) => statement.Sid === "WriteCoverageObjects"),
    );

    expect(coveragePolicies.length).toBe(2); /* one per environment (Test, Prod) */

    for (const policy of coveragePolicies) {
      for (const statement of policy.Properties.PolicyDocument.Statement) {
        const resources = Array.isArray(statement.Resource) ? statement.Resource : [statement.Resource];
        for (const resource of resources) {
          expect(resource).not.toBe("*");
        }
      }
    }
  });
});
