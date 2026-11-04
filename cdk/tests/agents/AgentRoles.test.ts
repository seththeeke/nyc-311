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

const AGENTS = [
  { name: "devx-agent", roleName: "Nyc311DevxAgentRole", userId: "DevxAgentUser", roleId: "DevxAgentRole" },
  { name: "cto-agent", roleName: "Nyc311CtoAgentRole", userId: "CtoAgentUser", roleId: "CtoAgentRole" },
];

describe("AgentRoles", () => {
  it("creates each agent's own user, with no access key", () => {
    for (const agent of AGENTS) template.hasResourceProperties("AWS::IAM::User", { UserName: agent.name });
    template.resourceCountIs("AWS::IAM::User", AGENTS.length);
    template.resourceCountIs("AWS::IAM::AccessKey", 0);
  });

  it.each(AGENTS)("gives $name AWS ReadOnlyAccess, an hour per session, assumable only by its own user as itself", (agent) => {
    template.hasResourceProperties("AWS::IAM::Role", {
      RoleName: agent.roleName,
      MaxSessionDuration: 3600,
      ManagedPolicyArns: [Match.objectLike({ "Fn::Join": Match.arrayWith([Match.arrayWith([":iam::aws:policy/ReadOnlyAccess"])]) })],
      AssumeRolePolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({ Action: "sts:AssumeRole", Condition: { StringEquals: { "sts:SourceIdentity": agent.name } } }),
          Match.objectLike({ Action: "sts:SetSourceIdentity", Condition: { StringEquals: { "sts:SourceIdentity": agent.name } } }),
        ]),
      },
    });
  });

  it("denies every role every secret read", () => {
    const policies = Object.values(template.findResources("AWS::IAM::Policy"));
    const denies = policies.flatMap((p) => p.Properties.PolicyDocument.Statement as { Sid?: string; Effect: string; Action: string[] }[]).filter((s) => s.Sid === "NeverSecrets");
    expect(denies).toHaveLength(AGENTS.length);
    for (const deny of denies) {
      expect(deny.Effect).toBe("Deny");
      expect(deny.Action).toEqual(expect.arrayContaining(["secretsmanager:GetSecretValue", "ssm:GetParameter", "kms:Decrypt"]));
    }
  });

  it.each(AGENTS)("lets $name's user assume only its own role", (agent) => {
    const policies = Object.values(template.findResources("AWS::IAM::Policy"));
    const statements = policies.filter((p) => JSON.stringify(p.Properties.Users ?? []).includes(agent.userId)).flatMap((p) => p.Properties.PolicyDocument.Statement as { Action: string[]; Resource: unknown }[]);
    expect(statements).toHaveLength(1);
    expect(statements[0].Action).toEqual(["sts:AssumeRole", "sts:SetSourceIdentity"]);
    expect(JSON.stringify(statements[0].Resource)).toContain(agent.roleId);
  });
});
