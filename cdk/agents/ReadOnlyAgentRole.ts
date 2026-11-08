import * as iam from "aws-cdk-lib/aws-iam";
import type { Construct } from "constructs";
import { AgentRole, type AgentRoleProps } from "./AgentRole";
import type { AgentIdentity } from "./agentIdentities";

export type ReadOnlyAgentRoleProps = AgentRoleProps;

/**
 * An agent's read-only AWS role: AWS's managed ReadOnlyAccess, in Test and
 * Prod alike (one account), never secrets (Secrets Manager values, SSM
 * parameters and KMS decrypts are denied). Assumable as AgentRole says.
 */
export class ReadOnlyAgentRole extends AgentRole {
  constructor(scope: Construct, id: string, agent: AgentIdentity, description: string, props: ReadOnlyAgentRoleProps) {
    super(scope, id, agent, description, props, [iam.ManagedPolicy.fromAwsManagedPolicyName("ReadOnlyAccess")]);
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
