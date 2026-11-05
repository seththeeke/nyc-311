import type { Construct } from "constructs";
import { DEVX_AGENT } from "./agentIdentities";
import { ReadOnlyAgentRole, type ReadOnlyAgentRoleProps } from "./ReadOnlyAgentRole";

/** The devx-agent's AWS role, for its pipeline, build-log and stack checks. */
export class DevxAgentRole extends ReadOnlyAgentRole {
  constructor(scope: Construct, id: string, props: ReadOnlyAgentRoleProps) {
    super(scope, id, DEVX_AGENT, "devx-agent: read-only AWS access from the Mac mini, never secrets", props);
  }
}
