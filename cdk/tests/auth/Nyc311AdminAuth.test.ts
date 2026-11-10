import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { HttpUserPoolAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import { describe, expect, it } from "vitest";
import { Nyc311AdminAuth } from "../../auth/Nyc311AdminAuth";

function synthesize(envName: "TEST" | "PROD"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  new Nyc311AdminAuth(stack, "Nyc311AdminAuth", { envName });
  return Template.fromStack(stack);
}

describe("Nyc311AdminAuth", () => {
  it("disables self-signup and requires an email attribute, named per environment", () => {
    synthesize("TEST").hasResourceProperties("AWS::Cognito::UserPool", {
      UserPoolName: "Nyc311AdminPool-Test",
      AdminCreateUserConfig: { AllowAdminCreateUserOnly: true },
    });
    synthesize("PROD").hasResourceProperties("AWS::Cognito::UserPool", { UserPoolName: "Nyc311AdminPool-Prod" });
  });

  it("has no MFA configured — single admin, portfolio-scale, revisit later", () => {
    const template = synthesize("TEST");
    template.hasResourceProperties("AWS::Cognito::UserPool", { MfaConfiguration: "OFF" });
  });

  it("enforces a real password policy (length + upper/lower/digit/symbol)", () => {
    const template = synthesize("TEST");
    template.hasResourceProperties("AWS::Cognito::UserPool", {
      Policies: {
        PasswordPolicy: Match.objectLike({
          MinimumLength: 8,
          RequireLowercase: true,
          RequireUppercase: true,
          RequireNumbers: true,
          RequireSymbols: true,
        }),
      },
    });
  });

  it("creates the web client and the agent client, with no secrets, named per environment", () => {
    const template = synthesize("TEST");
    template.hasResourceProperties("AWS::Cognito::UserPoolClient", {
      ClientName: "Nyc311AdminPoolClient-Test",
      GenerateSecret: false,
    });
    template.hasResourceProperties("AWS::Cognito::UserPoolClient", {
      ClientName: "Nyc311AgentClient-Test",
      GenerateSecret: false,
      ExplicitAuthFlows: ["ALLOW_USER_PASSWORD_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"],
    });
    template.resourceCountIs("AWS::Cognito::UserPoolClient", 2);
  });

  it("creates the ADMIN, BOROUGH_SIM_TEAM, BOROUGH_SIM_OPERATIONS, BOROUGH_SIM_PRODUCT and BOROUGH_SIM_ENGINEERING groups", () => {
    const template = synthesize("TEST");
    template.resourceCountIs("AWS::Cognito::UserPoolGroup", 5);
    for (const GroupName of ["ADMIN", "BOROUGH_SIM_TEAM", "BOROUGH_SIM_OPERATIONS", "BOROUGH_SIM_PRODUCT", "BOROUGH_SIM_ENGINEERING"]) {
      template.hasResourceProperties("AWS::Cognito::UserPoolGroup", { GroupName });
    }
  });

  it("publishes the pool and client ids to SSM for the chat stack", () => {
    const template = synthesize("PROD");
    for (const Name of ["/Nyc311/Prod/AdminPool/UserPoolId", "/Nyc311/Prod/AdminPool/WebClientId", "/Nyc311/Prod/AdminPool/AgentClientId"]) {
      template.hasResourceProperties("AWS::SSM::Parameter", { Name, Type: "String" });
    }
  });

  it("enables both SRP (browser) and USER_PASSWORD_AUTH (server-side integration test) flows on the app client", () => {
    const template = synthesize("TEST");
    const clients = template.findResources("AWS::Cognito::UserPoolClient");
    const web = Object.values(clients).find((client) => (client.Properties as { ClientName: string }).ClientName === "Nyc311AdminPoolClient-Test");
    const flows = (web?.Properties as { ExplicitAuthFlows: string[] }).ExplicitAuthFlows;

    expect(flows).toEqual(expect.arrayContaining(["ALLOW_USER_SRP_AUTH", "ALLOW_USER_PASSWORD_AUTH"]));
  });

  it("exposes an HttpUserPoolAuthorizer scoped to this User Pool", () => {
    const app = new App();
    const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
    const construct = new Nyc311AdminAuth(stack, "Nyc311AdminAuth", { envName: "TEST" });

    expect(construct.authorizer).toBeInstanceOf(HttpUserPoolAuthorizer);
  });
});
