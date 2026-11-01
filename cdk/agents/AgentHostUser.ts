import * as iam from "aws-cdk-lib/aws-iam";
import type { Construct } from "constructs";
import { AGENT_HOST_USER_NAME } from "./agentIdentities";

/**
 * The Mac mini's one IAM user (docs/agent-automation-setup.md). It holds no
 * permissions of its own beyond assuming the agent roles granted to it. Its
 * access key is created by hand in the console, never here, so the secret
 * never passes through CloudFormation.
 */
export class AgentHostUser extends iam.User {
  constructor(scope: Construct, id: string) {
    super(scope, id, { userName: AGENT_HOST_USER_NAME });
  }

  /** Lets this user assume `role`, stamping a source identity. */
  allowAssume(role: iam.IRole): void {
    this.addToPolicy(new iam.PolicyStatement({ actions: ["sts:AssumeRole", "sts:SetSourceIdentity"], resources: [role.roleArn] }));
  }
}
