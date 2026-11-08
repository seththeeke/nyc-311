import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { beforeAll, describe, expect, it } from "vitest";
import { agentReportsBucketName } from "../../agents/AgentReportsBucket";
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
  { name: "aws-cost-agent", roleName: "Nyc311CostAgentRole", userId: "CostAgentUser", roleId: "CostAgentRole" },
];

const SABLE = { name: "software-analyzer-agent", roleName: "Nyc311SoftwareAnalyzerAgentRole", userId: "SoftwareAnalyzerAgentUser", roleId: "SoftwareAnalyzerAgentRole" };

describe("AgentRoles", () => {
  it("creates each agent's own user, with no access key", () => {
    for (const agent of [...AGENTS, SABLE]) template.hasResourceProperties("AWS::IAM::User", { UserName: agent.name });
    template.resourceCountIs("AWS::IAM::User", AGENTS.length + 1);
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

  it.each([...AGENTS, SABLE])("lets $name's user assume only its own role", (agent) => {
    const policies = Object.values(template.findResources("AWS::IAM::Policy"));
    const statements = policies.filter((p) => JSON.stringify(p.Properties.Users ?? []).includes(agent.userId)).flatMap((p) => p.Properties.PolicyDocument.Statement as { Action: string[]; Resource: unknown }[]);
    expect(statements).toHaveLength(1);
    expect(statements[0].Action).toEqual(["sts:AssumeRole", "sts:SetSourceIdentity"]);
    expect(JSON.stringify(statements[0].Resource)).toContain(agent.roleId);
  });

  it("gives only aws-cost-agent the billing reads, and no billing writes", () => {
    const policies = Object.values(template.findResources("AWS::IAM::Policy"));
    const billing = policies.flatMap((p) => p.Properties.PolicyDocument.Statement as { Sid?: string; Effect: string; Action: string[] }[]).filter((s) => s.Sid === "BillingReads");
    expect(billing).toHaveLength(1);
    expect(billing[0].Effect).toBe("Allow");
    expect(billing[0].Action).toEqual(expect.arrayContaining(["ce:GetCostAndUsage", "ce:GetCostForecast", "budgets:ViewBudget"]));
    expect(billing[0].Action.every((a) => /^(ce|budgets):(Get|View|Describe)/.test(a))).toBe(true);
    const holder = policies.find((p) => JSON.stringify(p.Properties.PolicyDocument.Statement).includes("BillingReads"));
    expect(JSON.stringify(holder?.Properties.Roles)).toContain("CostAgentRole");
  });

  it("keeps the agents' reports in one private, TLS-only, retained bucket named for the account", () => {
    template.hasResource("AWS::S3::Bucket", {
      DeletionPolicy: "Retain",
      Properties: {
        BucketName: "nyc311-agent-reports-123456789012",
        PublicAccessBlockConfiguration: { BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true },
      },
    });
    const policy = Object.values(template.findResources("AWS::S3::BucketPolicy"))[0];
    expect(JSON.stringify(policy.Properties.PolicyDocument)).toContain("aws:SecureTransport");
    expect(agentReportsBucketName("1")).toBe("nyc311-agent-reports-1");
  });

  it("gives software-analyzer-agent only listing and writing its own prefix of the reports bucket", () => {
    template.hasResourceProperties("AWS::IAM::Role", {
      RoleName: SABLE.roleName,
      MaxSessionDuration: 3600,
      AssumeRolePolicyDocument: { Statement: Match.arrayWith([Match.objectLike({ Action: "sts:AssumeRole", Condition: { StringEquals: { "sts:SourceIdentity": SABLE.name } } })]) },
    });
    const role = Object.values(template.findResources("AWS::IAM::Role", { Properties: { RoleName: SABLE.roleName } }))[0];
    expect(role.Properties.ManagedPolicyArns).toBeUndefined();
    const policies = Object.values(template.findResources("AWS::IAM::Policy")).filter((p) => JSON.stringify(p.Properties.Roles ?? []).includes(SABLE.roleId));
    const statements = policies.flatMap((p) => p.Properties.PolicyDocument.Statement as { Sid: string; Effect: string; Action: string | string[]; Condition?: unknown; Resource: unknown }[]);
    expect(statements.map((s) => [s.Sid, s.Action])).toEqual([
      ["ListOwnReports", "s3:ListBucket"],
      ["WriteOwnReports", "s3:PutObject"],
    ]);
    expect(statements[0].Condition).toEqual({ StringLike: { "s3:prefix": ["software-analyzer-agent/", "software-analyzer-agent/*"] } });
    expect(JSON.stringify(statements[1].Resource)).toContain("/software-analyzer-agent/*");
  });
});
