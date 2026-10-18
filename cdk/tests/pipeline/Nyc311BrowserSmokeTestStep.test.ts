import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { beforeAll, describe, it } from "vitest";
import { Nyc311PipelineStack } from "../../pipeline/Nyc311PipelineStack";

const TEST_ENV = { account: "178280182163", region: "us-east-1" };

/* Synthesize once and share the Template, as Nyc311IntegrationTestStep.test.ts does. */
let template: Template;

beforeAll(() => {
  const app = new App();
  template = Template.fromStack(new Nyc311PipelineStack(app, "TestPipelineStack", { env: TEST_ENV }));
});

describe("Nyc311BrowserSmokeTestStep", () => {
  it("installs Chromium and runs web-app's smoke tests against the Test site", () => {
    template.hasResourceProperties("AWS::CodeBuild::Project", {
      Environment: Match.objectLike({ ComputeType: "BUILD_GENERAL1_MEDIUM" }),
      Source: Match.objectLike({
        BuildSpec: Match.stringLikeRegexp(
          "cd web-app && npm ci && npx playwright install --with-deps chromium && SMOKE_BASE_URL=https://test\\.boroughsim\\.com npm run test:smoke && cd \\.\\.",
        ),
      }),
    });
  });

  it("runs after the Test deploy, alongside the integration tests", () => {
    template.hasResourceProperties("AWS::CodePipeline::Pipeline", {
      Stages: Match.arrayWith([
        Match.objectLike({
          Name: "DeployTest",
          Actions: Match.arrayWith([Match.objectLike({ Name: "BrowserSmokeTestsTest" }), Match.objectLike({ Name: "IntegrationTestsTest" })]),
        }),
      ]),
    });
  });
});
