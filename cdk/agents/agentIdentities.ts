/*
 * Each agent with AWS access gets its own IAM user (holding its own access
 * key, created by hand) and its own role, which only that user can assume
 * (docs/agent-automation-setup.md). `name` is the source identity stamped on
 * every session, so CloudTrail records which agent acted.
 */
export interface AgentIdentity {
  name: string;
  userName: string;
  roleName: string;
}

export const DEVX_AGENT: AgentIdentity = { name: "devx-agent", userName: "devx-agent", roleName: "Nyc311DevxAgentRole" };
export const CTO_AGENT: AgentIdentity = { name: "cto-agent", userName: "cto-agent", roleName: "Nyc311CtoAgentRole" };
