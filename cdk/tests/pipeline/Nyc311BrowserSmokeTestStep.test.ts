import { readdirSync, readFileSync } from "node:fs";
import * as path from "node:path";
import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { beforeAll, describe, expect, it } from "vitest";
import { PLAYWRIGHT_LOCKED_VERSION } from "../../pipeline/Nyc311BrowserSmokeTestStep";
import { Nyc311PipelineStack } from "../../pipeline/Nyc311PipelineStack";

const TEST_ENV = { account: "178280182163", region: "us-east-1" };
const WEB_APP = path.join(__dirname, "..", "..", "..", "web-app");

/* Synthesize once and share the Template, as Nyc311IntegrationTestStep.test.ts does. */
let template: Template;

beforeAll(() => {
  const app = new App();
  template = Template.fromStack(new Nyc311PipelineStack(app, "TestPipelineStack", { env: TEST_ENV }));
});

/** Every module specifier a file imports, static or side-effect only. */
function importSpecifiers(file: string): string[] {
  const source = readFileSync(file, "utf8");
  return [...source.matchAll(/^\s*import\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/gm)].map((m) => m[1]);
}

describe("Nyc311BrowserSmokeTestStep", () => {
  it("installs only @playwright/test at web-app's locked version, then runs the smoke tests against the Test site", () => {
    template.hasResourceProperties("AWS::CodeBuild::Project", {
      Environment: Match.objectLike({ ComputeType: "BUILD_GENERAL1_MEDIUM" }),
      Source: Match.objectLike({
        BuildSpec: Match.stringLikeRegexp(
          "npm install --no-save --no-audit --no-fund @playwright/test@\\$\\(node -p .+\\) && cd web-app && \\.\\./node_modules/\\.bin/playwright install --with-deps chromium && SMOKE_BASE_URL=https://test\\.boroughsim\\.com npm run test:smoke && cd \\.\\.",
        ),
      }),
    });
  });

  it("never runs web-app's full npm ci or an npx playwright that could fetch another version", () => {
    const specs = Object.values(template.findResources("AWS::CodeBuild::Project"))
      .map((p) => JSON.stringify(p))
      .filter((p) => p.includes("test:smoke"));
    expect(specs).toHaveLength(1);
    expect(specs[0]).not.toContain("npm ci");
    expect(specs[0]).not.toContain("npx playwright");
  });

  /* The step installs nothing but @playwright/test, so a smoke file importing anything else would fail only in the pipeline. */
  it("web-app's Playwright config and smoke specs import only @playwright/test, node builtins or each other", () => {
    const smokeDir = path.join(WEB_APP, "tests", "smoke");
    const files = [
      path.join(WEB_APP, "playwright.config.ts"),
      ...readdirSync(smokeDir, { recursive: true })
        .map(String)
        .filter((f) => f.endsWith(".ts"))
        .map((f) => path.join(smokeDir, f)),
    ];
    expect(files.length).toBeGreaterThan(1);
    /* Every file imports @playwright/test, so an empty match means the regex broke, not that the files are clean. */
    for (const file of files) {
      expect(importSpecifiers(file), path.relative(WEB_APP, file)).toContain("@playwright/test");
      for (const specifier of importSpecifiers(file)) {
        const allowed = specifier === "@playwright/test" || specifier.startsWith("node:") || (specifier.startsWith("./") && !file.endsWith("playwright.config.ts"));
        expect(allowed, `${path.relative(WEB_APP, file)} imports "${specifier}"`).toBe(true);
      }
    }
  });

  it("reads a version web-app's lockfile actually pins", () => {
    const lock = JSON.parse(readFileSync(path.join(WEB_APP, "package-lock.json"), "utf8")) as {
      packages: Record<string, { version?: string }>;
    };
    expect(PLAYWRIGHT_LOCKED_VERSION).toContain("'node_modules/@playwright/test'");
    expect(lock.packages["node_modules/@playwright/test"]?.version).toMatch(/^\d+\.\d+\.\d+$/);
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
