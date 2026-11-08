import * as iam from "aws-cdk-lib/aws-iam";
import type { Construct } from "constructs";
import { AWS_COST_AGENT } from "./agentIdentities";
import { ReadOnlyAgentRole, type ReadOnlyAgentRoleProps } from "./ReadOnlyAgentRole";

/*
 * The aws-cost-agent's AWS role (docs/17-executive-team.md §18.2): read-only
 * like Pip's, never secrets, plus the billing reads it works from, Cost
 * Explorer and Budgets. Never a write: no budget, tag or anomaly-monitor
 * changes.
 */
export class CostAgentRole extends ReadOnlyAgentRole {
  constructor(scope: Construct, id: string, props: ReadOnlyAgentRoleProps) {
    super(scope, id, AWS_COST_AGENT, "aws-cost-agent: read-only AWS access and billing reads from the Mac mini, never secrets", props);
    this.addToPolicy(
      new iam.PolicyStatement({
        sid: "BillingReads",
        actions: ["ce:GetCostAndUsage", "ce:GetCostForecast", "ce:GetDimensionValues", "ce:GetTags", "budgets:ViewBudget", "budgets:DescribeBudgetPerformanceHistory"],
        resources: ["*"],
      })
    );
  }
}
