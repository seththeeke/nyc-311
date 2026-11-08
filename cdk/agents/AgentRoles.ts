import { Construct } from "constructs";
import { AgentReportsBucket } from "./AgentReportsBucket";
import { AWS_COST_AGENT, CTO_AGENT, DEVX_AGENT, SOFTWARE_ANALYZER_AGENT } from "./agentIdentities";
import { AgentUser } from "./AgentUser";
import { CostAgentRole } from "./CostAgentRole";
import { CtoAgentRole } from "./CtoAgentRole";
import { DevxAgentRole } from "./DevxAgentRole";
import { SoftwareAnalyzerAgentRole } from "./SoftwareAnalyzerAgentRole";

/**
 * Every agent's AWS identity in one place: per agent, its own user and its
 * own role, which only that user can assume, plus the agents' reports bucket
 * (docs/17-executive-team.md §19.6). Account-level, so it lives in
 * Nyc311PipelineStack rather than per environment.
 */
export class AgentRoles extends Construct {
  public readonly devxAgentUser: AgentUser;
  public readonly devxAgentRole: DevxAgentRole;
  public readonly ctoAgentUser: AgentUser;
  public readonly ctoAgentRole: CtoAgentRole;
  public readonly costAgentUser: AgentUser;
  public readonly costAgentRole: CostAgentRole;
  public readonly reportsBucket: AgentReportsBucket;
  public readonly softwareAnalyzerAgentUser: AgentUser;
  public readonly softwareAnalyzerAgentRole: SoftwareAnalyzerAgentRole;

  constructor(scope: Construct, id: string) {
    super(scope, id);
    this.devxAgentUser = new AgentUser(this, "DevxAgentUser", DEVX_AGENT);
    this.devxAgentRole = new DevxAgentRole(this, "DevxAgentRole", { agentUser: this.devxAgentUser });
    this.devxAgentUser.allowAssume(this.devxAgentRole);
    this.ctoAgentUser = new AgentUser(this, "CtoAgentUser", CTO_AGENT);
    this.ctoAgentRole = new CtoAgentRole(this, "CtoAgentRole", { agentUser: this.ctoAgentUser });
    this.ctoAgentUser.allowAssume(this.ctoAgentRole);
    this.costAgentUser = new AgentUser(this, "CostAgentUser", AWS_COST_AGENT);
    this.costAgentRole = new CostAgentRole(this, "CostAgentRole", { agentUser: this.costAgentUser });
    this.costAgentUser.allowAssume(this.costAgentRole);
    this.reportsBucket = new AgentReportsBucket(this, "AgentReportsBucket");
    this.softwareAnalyzerAgentUser = new AgentUser(this, "SoftwareAnalyzerAgentUser", SOFTWARE_ANALYZER_AGENT);
    this.softwareAnalyzerAgentRole = new SoftwareAnalyzerAgentRole(this, "SoftwareAnalyzerAgentRole", { agentUser: this.softwareAnalyzerAgentUser, reportsBucket: this.reportsBucket });
    this.softwareAnalyzerAgentUser.allowAssume(this.softwareAnalyzerAgentRole);
  }
}
