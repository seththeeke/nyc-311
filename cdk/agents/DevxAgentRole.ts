import { Duration } from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import type { Construct } from "constructs";
import { DEVX_AGENT } from "./agentIdentities";

export interface DevxAgentRoleProps {
  /** devx-agent's own IAM user, the only principal that can assume this role. */
  agentUser: iam.IUser;
}

/**
 * The devx-agent's AWS role: AWS's managed ReadOnlyAccess, for its
 * pipeline, build-log and stack checks, in Test and Prod alike (one
 * account). It can never read secrets: Secrets Manager values, SSM
 * parameters and KMS decrypts are denied outright. Only devx-agent's own
 * user can assume it, and only with the source identity `devx-agent`, so every
 * session is attributed in CloudTrail. Sessions last an hour; the CLI's
 * credential_process renews them.
 */
export class DevxAgentRole extends iam.Role {
  constructor(scope: Construct, id: string, props: DevxAgentRoleProps) {
    super(scope, id, {
      roleName: DEVX_AGENT.roleName,
      description: "devx-agent: read-only AWS access from the Mac mini, never secrets",
      assumedBy: new iam.ArnPrincipal(props.agentUser.userArn).withConditions({ StringEquals: { "sts:SourceIdentity": DEVX_AGENT.name } }),
      maxSessionDuration: Duration.hours(1),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName("ReadOnlyAccess")],
    });
    /* The trust policy must also allow stamping the source identity. */
    this.assumeRolePolicy?.addStatements(
      new iam.PolicyStatement({
        actions: ["sts:SetSourceIdentity"],
        principals: [new iam.ArnPrincipal(props.agentUser.userArn)],
        conditions: { StringEquals: { "sts:SourceIdentity": DEVX_AGENT.name } },
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
