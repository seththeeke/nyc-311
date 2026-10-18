import * as codebuild from "aws-cdk-lib/aws-codebuild";
import * as pipelines from "aws-cdk-lib/pipelines";
import { DOMAIN_CONFIG } from "../stack/Nyc311Stack";

export interface BrowserSmokeTestStepProps {
  /** Step id, e.g. "BrowserSmokeTestsTest" — must be unique within the pipeline. */
  id: string;
  /** Reused from the pipeline's own source, so web-app/ is present in this step's workspace. */
  source: pipelines.CodePipelineSource;
}

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
    commands: [`cd web-app && npm ci && npx playwright install --with-deps chromium && SMOKE_BASE_URL=${baseUrl} npm run test:smoke && cd ..`],
    /* MEDIUM, not SMALL: software WebGL is CPU-bound, and a starved renderer would flake the draw checks. */
    buildEnvironment: { computeType: codebuild.ComputeType.MEDIUM },
  });
}
