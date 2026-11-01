import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { beforeAll, describe, expect, it } from "vitest";
import { AgentRoles } from "../../agents/AgentRoles";

let template: Template;

beforeAll(() => {
  const stack = new Stack(new App(), "TestStack", { env: { account: "123456789012", region: "us-east-1" } });
  new AgentRoles(stack, "AgentRoles");
  template = Template.fromStack(stack);
});

describe("AgentRoles", () => {
  it("creates the host user with no access key", () => {
    template.hasResourceProperties("AWS::IAM::User", { UserName: "nyc311-agent-host" });
    template.resourceCountIs("AWS::IAM::AccessKey", 0);
  });

  it("gives devx-agent AWS ReadOnlyAccess, an hour per session, assumable only by the host user as devx-agent", () => {
    template.hasResourceProperties("AWS::IAM::Role", {
      RoleName: "Nyc311DevxAgentRole",
      MaxSessionDuration: 3600,
      ManagedPolicyArns: [Match.objectLike({ "Fn::Join": Match.arrayWith([Match.arrayWith([":iam::aws:policy/ReadOnlyAccess"])]) })],
      AssumeRolePolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({ Action: "sts:AssumeRole", Condition: { StringEquals: { "sts:SourceIdentity": "devx-agent" } } }),
          Match.objectLike({ Action: "sts:SetSourceIdentity", Condition: { StringEquals: { "sts:SourceIdentity": "devx-agent" } } }),
        ]),
      },
    });
  });

  it("denies the role every secret read", () => {
    const policies = Object.values(template.findResources("AWS::IAM::Policy"));
    const deny = policies.flatMap((p) => p.Properties.PolicyDocument.Statement as { Sid?: string; Effect: string; Action: string[] }[]).find((s) => s.Sid === "NeverSecrets");
    expect(deny?.Effect).toBe("Deny");
    expect(deny?.Action).toEqual(expect.arrayContaining(["secretsmanager:GetSecretValue", "ssm:GetParameter", "kms:Decrypt"]));
  });

  it("lets the host user assume only the agent roles", () => {
    const policies = Object.values(template.findResources("AWS::IAM::Policy"));
    const hostStatements = policies.filter((p) => JSON.stringify(p.Properties.Users ?? []).includes("AgentHostUser")).flatMap((p) => p.Properties.PolicyDocument.Statement as { Action: string[]; Resource: unknown }[]);
    expect(hostStatements).toHaveLength(1);
    expect(hostStatements[0].Action).toEqual(["sts:AssumeRole", "sts:SetSourceIdentity"]);
    expect(JSON.stringify(hostStatements[0].Resource)).toContain("DevxAgentRole");
  });
});
