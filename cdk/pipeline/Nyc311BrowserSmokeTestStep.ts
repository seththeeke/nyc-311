import * as codebuild from "aws-cdk-lib/aws-codebuild";
import * as pipelines from "aws-cdk-lib/pipelines";
import { DOMAIN_CONFIG } from "../stack/Nyc311Stack";
import { IMAGE_NODE_FLOOR_CHECK } from "./node22InstallCommands";

export interface BrowserSmokeTestStepProps {
  /** Step id, e.g. "BrowserSmokeTestsTest" — must be unique within the pipeline. */
  id: string;
  /** Reused from the pipeline's own source, so web-app/ is present in this step's workspace. */
  source: pipelines.CodePipelineSource;
}

/** Node expression printing the @playwright/test version web-app's lockfile pins; run from the repo root. */
export const PLAYWRIGHT_LOCKED_VERSION = "require('./web-app/package-lock.json').packages['node_modules/@playwright/test'].version";

/*
 * #215: no Node 22 download (~20s on DeployTest's critical path). This step
 * runs only Playwright (engine node >=20) against the deployed site, so the
 * image's default Node 24 does, behind the shared >=20 floor check.
 */
export const PLAYWRIGHT_NODE_CHECK = IMAGE_NODE_FLOOR_CHECK;

/**
 * A post-deploy step (docs/14-maps-refactor.md §4.8) that runs web-app's
 * Playwright smoke tests in headless Chromium against the live Test
 * site. WebGL runs on SwiftShader, so it proves the 3-D map draws in a
 * real browser. Blocking: a failure fails DeployTest and holds Prod back.
 */
export function createBrowserSmokeTestStep(props: BrowserSmokeTestStepProps): pipelines.CodeBuildStep {
  const baseUrl = `https://${DOMAIN_CONFIG.TEST.siteDomain}`;
  return new pipelines.CodeBuildStep(props.id, {
    input: props.source,
    installCommands: [PLAYWRIGHT_NODE_CHECK],
    /*
     * The smoke specs import only @playwright/test, so install just that (web-app's
     * locked version) at the repo root instead of web-app's ~550-package npm ci
     * (~36s, #190). web-app/ resolves it from ../node_modules and npm run finds the
     * parent's .bin. The local binary installs Chromium: npx could fetch another version.
     */
    /*
     * No --with-deps: the CodeBuild image already has every library Chromium needs, and
     * the apt run cost ~32s for fonts alone (#196). --only-shell skips the 187 MiB full
     * Chrome that headless runs never launch. A missing library fails the launch loudly.
     */
    commands: [
      `npm install --no-save --no-audit --no-fund @playwright/test@$(node -p "${PLAYWRIGHT_LOCKED_VERSION}") && cd web-app && ../node_modules/.bin/playwright install --only-shell chromium && SMOKE_BASE_URL=${baseUrl} npm run test:smoke && cd ..`,
    ],
    /* MEDIUM, not SMALL: software WebGL is CPU-bound, and a starved renderer would flake the draw checks. */
    buildEnvironment: { computeType: codebuild.ComputeType.MEDIUM },
  });
}
