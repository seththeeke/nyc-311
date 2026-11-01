import { Construct } from "constructs";
import { DEVX_AGENT } from "./agentIdentities";
import { AgentUser } from "./AgentUser";
import { DevxAgentRole } from "./DevxAgentRole";

/**
 * Every agent's AWS identity in one place: per agent, its own user and its
 * own role, which only that user can assume. Account-level, so it lives in
 * Nyc311PipelineStack rather than per environment.
 */
export class AgentRoles extends Construct {
  public readonly devxAgentUser: AgentUser;
  public readonly devxAgentRole: DevxAgentRole;

  constructor(scope: Construct, id: string) {
    super(scope, id);
    this.devxAgentUser = new AgentUser(this, "DevxAgentUser", DEVX_AGENT);
    this.devxAgentRole = new DevxAgentRole(this, "DevxAgentRole", { agentUser: this.devxAgentUser });
    this.devxAgentUser.allowAssume(this.devxAgentRole);
  }
}
