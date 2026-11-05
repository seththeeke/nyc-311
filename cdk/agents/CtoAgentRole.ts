import type { Construct } from "constructs";
import { CTO_AGENT } from "./agentIdentities";
import { ReadOnlyAgentRole, type ReadOnlyAgentRoleProps } from "./ReadOnlyAgentRole";

/** The cto-agent's AWS role, for checking what a change under review touches (docs/17-executive-team.md §16). */
export class CtoAgentRole extends ReadOnlyAgentRole {
  constructor(scope: Construct, id: string, props: ReadOnlyAgentRoleProps) {
    super(scope, id, CTO_AGENT, "cto-agent: read-only AWS access from the Mac mini, never secrets", props);
  }
}
