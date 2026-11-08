import * as iam from "aws-cdk-lib/aws-iam";
import type * as s3 from "aws-cdk-lib/aws-s3";
import type { Construct } from "constructs";
import { AgentRole, type AgentRoleProps } from "./AgentRole";
import { SOFTWARE_ANALYZER_AGENT } from "./agentIdentities";

export interface SoftwareAnalyzerAgentRoleProps extends AgentRoleProps {
  reportsBucket: s3.IBucket;
}

/*
 * The software-analyzer-agent's AWS role (docs/17-executive-team.md §19.6):
 * nothing but writing its own reports to the reports bucket, under its own
 * prefix. Used by the scheduler's sync after a run, never by the agent.
 */
export class SoftwareAnalyzerAgentRole extends AgentRole {
  constructor(scope: Construct, id: string, props: SoftwareAnalyzerAgentRoleProps) {
    super(scope, id, SOFTWARE_ANALYZER_AGENT, "software-analyzer-agent: syncs its reports to the reports bucket from the Mac mini", props);
    const prefix = `${SOFTWARE_ANALYZER_AGENT.name}/`;
    this.addToPolicy(
      new iam.PolicyStatement({
        sid: "ListOwnReports",
        actions: ["s3:ListBucket"],
        resources: [props.reportsBucket.bucketArn],
        conditions: { StringLike: { "s3:prefix": [prefix, `${prefix}*`] } },
      })
    );
    this.addToPolicy(new iam.PolicyStatement({ sid: "WriteOwnReports", actions: ["s3:PutObject"], resources: [props.reportsBucket.arnForObjects(`${prefix}*`)] }));
  }
}
