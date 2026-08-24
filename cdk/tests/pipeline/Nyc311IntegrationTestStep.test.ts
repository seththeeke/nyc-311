import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { Nyc311PipelineStack } from "../../pipeline/Nyc311PipelineStack";

const TEST_ENV = { account: "178280182163", region: "us-east-1" };

function synthesize(): Template {
  const app = new App();
  const stack = new Nyc311PipelineStack(app, "TestPipelineStack", { env: TEST_ENV });
  return Template.fromStack(stack);
}

describe("Nyc311IntegrationTestStep", () => {
  it("runs the Test-targeted suite and propagates its real exit code (blocking)", () => {
    const template = synthesize();

    template.hasResourceProperties("AWS::CodeBuild::Project", {
      Source: Match.objectLike({
        BuildSpec: Match.stringLikeRegexp(
          "cd backend && npm ci && \\(npm run test:integration:test[\\s\\S]*\\) && cd \\.\\.[\\s\\S]*aws s3 cp backend/tests/integration/reports/route-report\\.json s3://nyc311-web-test/integration-tests/route-report\\.json[\\s\\S]*aws cloudfront create-invalidation --distribution-id E1EFLKB8JSXGXU --paths \\\\\"/integration-tests/\\*\\\\\"[\\s\\S]*exit \\$\\(cat /tmp/integration-test-exit-code\\)",
        ),
      }),
    });
  });

  it("returns to the repo root before the s3 cp, since CodeBuild's commands share one shell and `cd backend` would otherwise leak into later commands (regression: a real pipeline run once failed exactly this way)", () => {
    const template = synthesize();

    template.hasResourceProperties("AWS::CodeBuild::Project", {
      Source: Match.objectLike({
        BuildSpec: Match.stringLikeRegexp("cd backend[\\s\\S]*&& cd \\.\\."),
      }),
    });
  });

  it("runs the Prod-targeted suite but always exits 0 (non-blocking)", () => {
    const template = synthesize();

    template.hasResourceProperties("AWS::CodeBuild::Project", {
      Source: Match.objectLike({
        BuildSpec: Match.stringLikeRegexp(
          "cd backend && npm ci && \\(npm run test:integration:prod[\\s\\S]*aws s3 cp backend/tests/integration/reports/route-report\\.json s3://nyc311-web-prod/integration-tests/route-report\\.json[\\s\\S]*aws cloudfront create-invalidation --distribution-id E1FXE4OBQCY52G --paths \\\\\"/integration-tests/\\*\\\\\"[\\s\\S]*exit 0",
        ),
      }),
    });
  });

  it("wires each environment's real Nyc311ApiUrl output in as API_BASE_URL, not a hardcoded value", () => {
    const template = synthesize();

    template.hasResourceProperties("AWS::CodePipeline::Pipeline", {
      Stages: Match.arrayWith([
        Match.objectLike({
          Name: "DeployTest",
          Actions: Match.arrayWith([
            Match.objectLike({
              Name: "IntegrationTestsTest",
              Configuration: Match.objectLike({
                EnvironmentVariables: Match.stringLikeRegexp('.*"API_BASE_URL".*#\\{.*\\.Nyc311ApiUrl\\}.*'),
              }),
            }),
          ]),
        }),
        Match.objectLike({
          Name: "DeployProd",
          Actions: Match.arrayWith([
            Match.objectLike({
              Name: "IntegrationTestsProd",
              Configuration: Match.objectLike({
                EnvironmentVariables: Match.stringLikeRegexp('.*"API_BASE_URL".*#\\{.*\\.Nyc311ApiUrl\\}.*'),
              }),
            }),
          ]),
        }),
      ]),
    });
  });

  it("scopes each publish role to only /integration-tests/* on that one bucket, never a wildcard resource", () => {
    const template = synthesize();

    const policies = Object.values(template.findResources("AWS::IAM::Policy")) as {
      Properties: { PolicyDocument: { Statement: { Sid?: string; Resource: string | string[] }[] } };
    }[];
    const reportPolicies = policies.filter((policy) =>
      policy.Properties.PolicyDocument.Statement.some((statement) => statement.Sid === "WriteIntegrationTestReportObjects"),
    );

    expect(reportPolicies.length).toBe(2); /* one per environment (Test, Prod) */

    for (const policy of reportPolicies) {
      for (const statement of policy.Properties.PolicyDocument.Statement) {
        const resources = Array.isArray(statement.Resource) ? statement.Resource : [statement.Resource];
        for (const resource of resources) {
          expect(resource).not.toBe("*");
        }
      }
    }

    template.hasResourceProperties("AWS::IAM::Policy", {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Sid: "WriteIntegrationTestReportObjects",
            Resource: "arn:aws:s3:::nyc311-web-test/integration-tests/*",
          }),
        ]),
      }),
    });
  });
});
