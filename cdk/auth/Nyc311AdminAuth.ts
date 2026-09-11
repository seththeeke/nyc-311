import { Duration, RemovalPolicy } from "aws-cdk-lib";
import { AccountRecovery, Mfa, UserPool, UserPoolClient } from "aws-cdk-lib/aws-cognito";
import { HttpUserPoolAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import { Construct } from "constructs";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311AdminAuthProps {
  envName: Nyc311Environment;
}

/**
 * The single-admin auth surface (`9-admin-auth-integration.md`) —
 * one Cognito User Pool per environment, self-signup disabled entirely
 * (the one admin account per environment is created via a one-time
 * `admin-create-user` CLI call, §1 — never scripted here), plus the HTTP
 * API JWT authorizer (`HttpUserPoolAuthorizer`, native — no Lambda
 * authorizer) that admin-only routes attach in `Nyc311Api` (§4).
 */
export class Nyc311AdminAuth extends Construct {
  public readonly userPool: UserPool;
  public readonly userPoolClient: UserPoolClient;
  public readonly authorizer: HttpUserPoolAuthorizer;

  constructor(scope: Construct, id: string, props: Nyc311AdminAuthProps) {
    super(scope, id);

    const suffix = ENV_NAME_SUFFIX[props.envName];

    this.userPool = new UserPool(this, "UserPool", {
      userPoolName: `Nyc311AdminPool-${suffix}`,
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      standardAttributes: { email: { required: true, mutable: true } },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      mfa: Mfa.OFF, /* Agreed §2 — single admin, portfolio-scale project; revisit if that ever changes. */
      accountRecovery: AccountRecovery.EMAIL_ONLY,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    this.userPoolClient = new UserPoolClient(this, "UserPoolClient", {
      userPool: this.userPool,
      userPoolClientName: `Nyc311AdminPoolClient-${suffix}`,
      generateSecret: false, /* A browser SPA can't keep a client secret confidential. */
      authFlows: {
        userSrp: true,
        /*
         * Used only by the integration suite's server-side test-admin
         * sign-in (9-admin-auth-integration.md §8) — backend/ has no
         * SRP-capable library. The browser/Amplify login path never uses
         * this flow.
         */
        userPassword: true,
      },
      accessTokenValidity: Duration.hours(1),
      idTokenValidity: Duration.hours(1),
    });

    this.authorizer = new HttpUserPoolAuthorizer("Nyc311AdminAuthorizer", this.userPool, {
      userPoolClients: [this.userPoolClient],
    });
  }
}
