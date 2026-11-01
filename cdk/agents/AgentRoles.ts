import { Construct } from "constructs";
import { AgentHostUser } from "./AgentHostUser";
import { DevxAgentRole } from "./DevxAgentRole";

/**
 * Every agent's AWS identity in one place: the Mac mini's host user and
 * one role per agent. Account-level, so it lives in Nyc311PipelineStack
 * rather than per environment.
 */
export class AgentRoles extends Construct {
  public readonly hostUser: AgentHostUser;
  public readonly devxAgentRole: DevxAgentRole;

  constructor(scope: Construct, id: string) {
    super(scope, id);
    this.hostUser = new AgentHostUser(this, "AgentHostUser");
    this.devxAgentRole = new DevxAgentRole(this, "DevxAgentRole", { hostUser: this.hostUser });
    this.hostUser.allowAssume(this.devxAgentRole);
  }
}
