import * as iam from "aws-cdk-lib/aws-iam";
import type { Construct } from "constructs";
import type { AgentIdentity } from "./agentIdentities";

/**
 * One agent's IAM user (docs/agent-automation-setup.md). It holds no
 * permissions of its own beyond assuming its agent's role. Its access key
 * is created by hand in the console, never here, so the secret never
 * passes through CloudFormation, and a leaked key reaches only this agent.
 */
export class AgentUser extends iam.User {
  constructor(scope: Construct, id: string, agent: AgentIdentity) {
    super(scope, id, { userName: agent.userName });
  }

  /** Lets this user assume `role`, stamping a source identity. */
  allowAssume(role: iam.IRole): void {
    this.addToPolicy(new iam.PolicyStatement({ actions: ["sts:AssumeRole", "sts:SetSourceIdentity"], resources: [role.roleArn] }));
  }
}
