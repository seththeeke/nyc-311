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
export const AWS_COST_AGENT: AgentIdentity = { name: "aws-cost-agent", userName: "aws-cost-agent", roleName: "Nyc311CostAgentRole" };
export const GEN_PURPOSE_DEV: AgentIdentity = { name: "gen-purpose-dev", userName: "gen-purpose-dev", roleName: "Nyc311EngineerAgentRole" };
export const SOFTWARE_ANALYZER_AGENT: AgentIdentity = { name: "software-analyzer-agent", userName: "software-analyzer-agent", roleName: "Nyc311SoftwareAnalyzerAgentRole" };
