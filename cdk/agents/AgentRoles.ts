import { Construct } from "constructs";
import { CTO_AGENT, DEVX_AGENT } from "./agentIdentities";
import { AgentUser } from "./AgentUser";
import { CtoAgentRole } from "./CtoAgentRole";
import { DevxAgentRole } from "./DevxAgentRole";

/**
 * Every agent's AWS identity in one place: per agent, its own user and its
 * own role, which only that user can assume. Account-level, so it lives in
 * Nyc311PipelineStack rather than per environment.
 */
export class AgentRoles extends Construct {
  public readonly devxAgentUser: AgentUser;
  public readonly devxAgentRole: DevxAgentRole;
  public readonly ctoAgentUser: AgentUser;
  public readonly ctoAgentRole: CtoAgentRole;

  constructor(scope: Construct, id: string) {
    super(scope, id);
    this.devxAgentUser = new AgentUser(this, "DevxAgentUser", DEVX_AGENT);
    this.devxAgentRole = new DevxAgentRole(this, "DevxAgentRole", { agentUser: this.devxAgentUser });
    this.devxAgentUser.allowAssume(this.devxAgentRole);
    this.ctoAgentUser = new AgentUser(this, "CtoAgentUser", CTO_AGENT);
    this.ctoAgentRole = new CtoAgentRole(this, "CtoAgentRole", { agentUser: this.ctoAgentUser });
    this.ctoAgentUser.allowAssume(this.ctoAgentRole);
  }
}
