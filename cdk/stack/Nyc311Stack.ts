import { Stack, StackProps, Tags } from "aws-cdk-lib";
import type { Construct } from "constructs";
import { RequestsTable } from "../data/RequestsTable";
import { Nyc311PollerLambda } from "../lambda/Nyc311PollerLambda";
import { Nyc311PollerSchedule } from "../lambda/Nyc311PollerSchedule";

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
 * constructs under `lambda/`, `data/`, `step-function/`) as each slice of
 * `claude-prompt-initial.md`'s build order is unlocked.
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
  }
}
