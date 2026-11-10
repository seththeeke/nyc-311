import { readdirSync, readFileSync } from "node:fs";
import * as path from "node:path";
import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { beforeAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { PLAYWRIGHT_LOCKED_VERSION, PLAYWRIGHT_NODE_CHECK } from "../../pipeline/Nyc311BrowserSmokeTestStep";
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
          "npm install --no-save --no-audit --no-fund @playwright/test@\\$\\(node -p .+\\) && cd web-app && \\.\\./node_modules/\\.bin/playwright install --only-shell chromium && SMOKE_BASE_URL=https://test\\.boroughsim\\.com npm run test:smoke && cd \\.\\.",
        ),
      }),
    });
  });

  /* #215: the Node 22 download cost ~20s on DeployTest's critical path; Playwright needs only node >=20. */
  it("runs on the image's default Node with a >=20 floor check, never downloading Node 22", () => {
    const projects = Object.values(template.findResources("AWS::CodeBuild::Project"))
      .map((p) => p.Properties as { Source: { BuildSpec: string } })
      .filter((p) => p.Source.BuildSpec.includes("test:smoke"));
    expect(projects).toHaveLength(1);
    const install = (JSON.parse(projects[0].Source.BuildSpec) as { phases: { install: Record<string, unknown> & { commands: string[] } } }).phases.install;
    expect(install).not.toHaveProperty("runtime-versions");
    expect(install.commands.filter((c) => !c.includes("ln -s --"))).toEqual([PLAYWRIGHT_NODE_CHECK]);
    expect(projects[0].Source.BuildSpec).not.toContain("NODE_22_VERSION");
  });

  it("the floor check's pattern passes Node 20-99 and fails 18 and 19", () => {
    const pattern = /'(.+)'$/.exec(PLAYWRIGHT_NODE_CHECK)?.[1] as string;
    const passes = (version: string): boolean => {
      try {
        execFileSync("grep", ["-E", pattern], { input: `${version}\n` });
        return true;
      } catch {
        return false;
      }
    };
    expect(["v20.19.0", "v22.23.4", "v24.11.1", "v26.10.0"].every(passes)).toBe(true);
    expect(["v18.20.4", "v19.9.0", "v2.0.0"].some(passes)).toBe(false);
  });

  it("never runs web-app's full npm ci or an npx playwright that could fetch another version", () => {
    const specs = Object.values(template.findResources("AWS::CodeBuild::Project"))
      .map((p) => JSON.stringify(p))
      .filter((p) => p.includes("test:smoke"));
    expect(specs).toHaveLength(1);
    expect(specs[0]).not.toContain("npm ci");
    expect(specs[0]).not.toContain("npx playwright");
  });

  /* The image already has Chromium's libraries; --with-deps added ~32s of apt work for fonts (#196). */
  it("skips apt deps and the full Chrome download", () => {
    const spec = Object.values(template.findResources("AWS::CodeBuild::Project"))
      .map((p) => JSON.stringify(p))
      .find((p) => p.includes("test:smoke"));
    expect(spec).not.toContain("--with-deps");
    expect(spec).not.toContain("install-deps");
    expect(spec).toContain("--only-shell");
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
