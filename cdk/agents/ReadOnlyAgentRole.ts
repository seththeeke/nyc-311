import { Duration } from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import type { Construct } from "constructs";
import type { AgentIdentity } from "./agentIdentities";

export interface ReadOnlyAgentRoleProps {
  /** The agent's own IAM user, the only principal that can assume this role. */
  agentUser: iam.IUser;
}

/**
 * An agent's read-only AWS role: AWS's managed ReadOnlyAccess, in Test and
 * Prod alike (one account), never secrets (Secrets Manager values, SSM
 * parameters and KMS decrypts are denied). Only the agent's own user can
 * assume it, and only with the agent's name as source identity, so CloudTrail
 * attributes every session. Sessions last an hour; credential_process renews them.
 */
export class ReadOnlyAgentRole extends iam.Role {
  constructor(scope: Construct, id: string, agent: AgentIdentity, description: string, props: ReadOnlyAgentRoleProps) {
    super(scope, id, {
      roleName: agent.roleName,
      description,
      assumedBy: new iam.ArnPrincipal(props.agentUser.userArn).withConditions({ StringEquals: { "sts:SourceIdentity": agent.name } }),
      maxSessionDuration: Duration.hours(1),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName("ReadOnlyAccess")],
    });
    /* The trust policy must also allow stamping the source identity. */
    this.assumeRolePolicy?.addStatements(
      new iam.PolicyStatement({
        actions: ["sts:SetSourceIdentity"],
        principals: [new iam.ArnPrincipal(props.agentUser.userArn)],
        conditions: { StringEquals: { "sts:SourceIdentity": agent.name } },
      })
    );
    this.addToPolicy(
      new iam.PolicyStatement({
        sid: "NeverSecrets",
        effect: iam.Effect.DENY,
        actions: ["secretsmanager:GetSecretValue", "ssm:GetParameter", "ssm:GetParameters", "ssm:GetParametersByPath", "ssm:GetParameterHistory", "kms:Decrypt"],
        resources: ["*"],
      })
    );
  }
}
