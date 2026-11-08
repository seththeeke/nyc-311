import { Duration } from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import type { Construct } from "constructs";
import type { AgentIdentity } from "./agentIdentities";

export interface AgentRoleProps {
  /** The agent's own IAM user, the only principal that can assume this role. */
  agentUser: iam.IUser;
}

/**
 * An agent's AWS role, with no permissions of its own: only the agent's own
 * user can assume it, and only with the agent's name as source identity, so
 * CloudTrail attributes every session. Sessions last an hour;
 * credential_process renews them.
 */
export class AgentRole extends iam.Role {
  constructor(scope: Construct, id: string, agent: AgentIdentity, description: string, props: AgentRoleProps, managedPolicies: iam.IManagedPolicy[] = []) {
    super(scope, id, {
      roleName: agent.roleName,
      description,
      assumedBy: new iam.ArnPrincipal(props.agentUser.userArn).withConditions({ StringEquals: { "sts:SourceIdentity": agent.name } }),
      maxSessionDuration: Duration.hours(1),
      managedPolicies,
    });
    /* The trust policy must also allow stamping the source identity. */
    this.assumeRolePolicy?.addStatements(
      new iam.PolicyStatement({
        actions: ["sts:SetSourceIdentity"],
        principals: [new iam.ArnPrincipal(props.agentUser.userArn)],
        conditions: { StringEquals: { "sts:SourceIdentity": agent.name } },
      })
    );
  }
}
