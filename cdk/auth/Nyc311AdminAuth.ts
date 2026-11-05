import { Duration, RemovalPolicy } from "aws-cdk-lib";
import { AccountRecovery, CfnUserPoolGroup, Mfa, UserPool, UserPoolClient } from "aws-cdk-lib/aws-cognito";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { HttpUserPoolAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import { Construct } from "constructs";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

/*
 * The pool's groups (docs/17-executive-team.md §12.2). Must match
 * `backend/models/cognitoGroup.ts`'s COGNITO_GROUPS, which the routes check;
 * declared here because cdk/ imports nothing from backend/ but route lists.
 */
export const COGNITO_GROUP_NAMES = ["ADMIN", "BOROUGH_SIM_TEAM", "BOROUGH_SIM_OPERATIONS", "BOROUGH_SIM_PRODUCT"] as const;

/*
 * Where the pool's ids are published for Nyc311TeamChatStack, which reads
 * them at deploy time instead of a CloudFormation export
 * (docs/17-executive-team.md §10.5).
 */
export function adminPoolParameterNames(suffix: string): { userPoolId: string; webClientId: string; agentClientId: string } {
  const base = `/Nyc311/${suffix}/AdminPool`;
  return { userPoolId: `${base}/UserPoolId`, webClientId: `${base}/WebClientId`, agentClientId: `${base}/AgentClientId` };
}

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
  /** Agents' sign-in client (docs/17-executive-team.md §12.2): USER_PASSWORD_AUTH only, no hosted UI. */
  public readonly agentClient: UserPoolClient;
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

    this.agentClient = new UserPoolClient(this, "AgentClient", {
      userPool: this.userPool,
      userPoolClientName: `Nyc311AgentClient-${suffix}`,
      generateSecret: false,
      authFlows: { userPassword: true },
      accessTokenValidity: Duration.hours(1),
      idTokenValidity: Duration.hours(1),
      refreshTokenValidity: Duration.days(1),
    });

    /* A valid token grants nothing on its own: every JWT route checks these groups (§12.2). */
    for (const groupName of COGNITO_GROUP_NAMES) {
      new CfnUserPoolGroup(this, `Group${groupName}`, { userPoolId: this.userPool.userPoolId, groupName });
    }

    this.authorizer = new HttpUserPoolAuthorizer("Nyc311AdminAuthorizer", this.userPool, {
      userPoolClients: [this.userPoolClient, this.agentClient],
    });

    const names = adminPoolParameterNames(suffix);
    new StringParameter(this, "UserPoolIdParameter", { parameterName: names.userPoolId, stringValue: this.userPool.userPoolId });
    new StringParameter(this, "WebClientIdParameter", { parameterName: names.webClientId, stringValue: this.userPoolClient.userPoolClientId });
    new StringParameter(this, "AgentClientIdParameter", { parameterName: names.agentClientId, stringValue: this.agentClient.userPoolClientId });
  }
}
