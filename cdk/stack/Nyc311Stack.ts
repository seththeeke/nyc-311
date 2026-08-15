import { CfnOutput, Stack, StackProps, Tags } from "aws-cdk-lib";
import type { Construct } from "constructs";
import { RequestsTable } from "../data/RequestsTable";
import { Nyc311PollerLambda } from "../lambda/Nyc311PollerLambda";
import { Nyc311PollerSchedule } from "../lambda/Nyc311PollerSchedule";
import { Nyc311MetricsApiLambda } from "../lambda/Nyc311MetricsApiLambda";
import { Nyc311Api } from "../api/Nyc311Api";
import { WebsiteHosting } from "../web/WebsiteHosting";
import { WebsiteDeployment } from "../web/WebsiteDeployment";

// Enum-like discriminator, ALL_CAPS per CLAUDE.md §6.
export type Nyc311Environment = "TEST" | "PROD";

export interface Nyc311StackProps extends StackProps {
  envName: Nyc311Environment;
}

// The shared per-environment physical-name suffix, per CLAUDE.md §5.3 —
// every named resource in this stack is suffixed this way (not just
// tagged) so it's identifiable at a glance in the console/CLI, not only
// by which CloudFormation stack it belongs to. Title-case, not ALL_CAPS —
// physical infrastructure names follow their own convention, per
// CLAUDE.md §6's carve-out.
export const ENV_NAME_SUFFIX: Record<Nyc311Environment, string> = {
  TEST: "Test",
  PROD: "Prod",
};

// 1-data-ingestion.md §5 — same address the pipeline's own failure
// notifications already go to (pipeline/Nyc311PipelineStack.ts).
const FAILURE_NOTIFICATION_EMAIL = "seththeeke@gmail.com";

/**
 * The application's single stack shape, per CLAUDE.md §5.3 — one Stack
 * class, instantiated once per environment from `bin/app.ts` rather than
 * split into multiple stack types. Resources get added here (via custom
 * constructs under `lambda/`, `data/`, `step-function/`, `web/`) as each
 * slice of `claude-prompt-initial.md`'s build order is unlocked.
 *
 * First slice: the NYC 311 poller (`1-data-ingestion.md`) — raw ingest
 * only, EventBridge Scheduler → Lambda → DynamoDB, no event bus/queue
 * downstream yet (out of scope for this slice, per §1).
 */
export class Nyc311Stack extends Stack {
  constructor(scope: Construct, id: string, props: Nyc311StackProps) {
    super(scope, id, props);

    Tags.of(this).add("Environment", props.envName);

    const requestsTable = new RequestsTable(this, "RequestsTable", { envName: props.envName });

    const pollerLambda = new Nyc311PollerLambda(this, "Nyc311PollerLambda", {
      envName: props.envName,
      requestsTable,
    });

    new Nyc311PollerSchedule(this, "Nyc311PollerSchedule", {
      envName: props.envName,
      pollerLambda,
      failureNotificationEmail: FAILURE_NOTIFICATION_EMAIL,
    });

    const websiteHosting = new WebsiteHosting(this, "WebsiteHosting", { envName: props.envName });

    const metricsApiLambda = new Nyc311MetricsApiLambda(this, "Nyc311MetricsApiLambda", {
      envName: props.envName,
      requestsTable,
    });

    const nyc311Api = new Nyc311Api(this, "Nyc311Api", {
      envName: props.envName,
      metricsApiLambda,
      webAppDomainName: websiteHosting.distribution.domainName,
    });

    // Read by test-scripts/2-metrics-api-test.py (and any future
    // integration test) via `aws cloudformation describe-stacks`, so the
    // deployed API's base URL doesn't have to be hand-copied out of the
    // console.
    new CfnOutput(this, "Nyc311ApiUrl", { value: nyc311Api.apiEndpoint });

    // Deploys web-app/dist + the runtime env-config.json last, once both
    // WebsiteHosting (for the bucket/distribution) and Nyc311Api (for the
    // API URL that config.json carries) exist — see WebsiteHosting.ts's
    // doc comment for why this can't happen inside either of those two
    // constructs without a circular dependency between them.
    new WebsiteDeployment(this, "WebsiteDeployment", {
      websiteHosting,
      apiBaseUrl: nyc311Api.apiEndpoint,
    });
  }
}
