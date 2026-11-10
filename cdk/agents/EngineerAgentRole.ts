import type { Construct } from "constructs";
import { GEN_PURPOSE_DEV } from "./agentIdentities";
import { ReadOnlyAgentRole, type ReadOnlyAgentRoleProps } from "./ReadOnlyAgentRole";

/** Kid Kestrel's (gen-purpose-dev) AWS role, for verifying his work through logs and resource state (docs/17-executive-team.md §22.9). */
export class EngineerAgentRole extends ReadOnlyAgentRole {
  constructor(scope: Construct, id: string, props: ReadOnlyAgentRoleProps) {
    super(scope, id, GEN_PURPOSE_DEV, "gen-purpose-dev: read-only AWS access from the Mac mini, never secrets", props);
  }
}
