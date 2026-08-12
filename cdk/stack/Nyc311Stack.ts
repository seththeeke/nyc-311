import { Stack, StackProps, Tags } from "aws-cdk-lib";
import type { Construct } from "constructs";

// Enum-like discriminator, ALL_CAPS per CLAUDE.md §6.
export type Nyc311Environment = "TEST" | "PROD";

export interface Nyc311StackProps extends StackProps {
  envName: Nyc311Environment;
}

/**
 * The application's single stack shape, per CLAUDE.md §5.3 — one Stack
 * class, instantiated once per environment from `bin/app.ts` rather than
 * split into multiple stack types. Resources get added here (via custom
 * constructs under `lambda/`, `data/`, `step-function/`) as each slice of
 * `claude-prompt-initial.md`'s build order is unlocked; this is
 * deliberately the skeleton, not the full application.
 */
export class Nyc311Stack extends Stack {
  constructor(scope: Construct, id: string, props: Nyc311StackProps) {
    super(scope, id, props);

    Tags.of(this).add("Environment", props.envName);
  }
}
