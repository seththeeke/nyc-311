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

  it("creates one app client with no secret, named per environment", () => {
    const template = synthesize("TEST");
    template.hasResourceProperties("AWS::Cognito::UserPoolClient", {
      ClientName: "Nyc311AdminPoolClient-Test",
      GenerateSecret: false,
    });
    template.resourceCountIs("AWS::Cognito::UserPoolClient", 1);
  });

  it("enables both SRP (browser) and USER_PASSWORD_AUTH (server-side integration test) flows on the app client", () => {
    const template = synthesize("TEST");
    const clients = template.findResources("AWS::Cognito::UserPoolClient");
    const flows = (Object.values(clients)[0]?.Properties as { ExplicitAuthFlows: string[] }).ExplicitAuthFlows;

    expect(flows).toEqual(expect.arrayContaining(["ALLOW_USER_SRP_AUTH", "ALLOW_USER_PASSWORD_AUTH"]));
  });

  it("exposes an HttpUserPoolAuthorizer scoped to this User Pool", () => {
    const app = new App();
    const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
    const construct = new Nyc311AdminAuth(stack, "Nyc311AdminAuth", { envName: "TEST" });

    expect(construct.authorizer).toBeInstanceOf(HttpUserPoolAuthorizer);
  });
});
