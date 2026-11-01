import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { beforeAll, describe, expect, it } from "vitest";
import { TEAM_CHAT_MEMBER_ROUTES, TEAM_CHAT_READ_ROUTES } from "../../../backend/controller/web-api/teamChat/teamChatApiRoutes";
import { Nyc311TeamChatStack } from "../../teamChat/Nyc311TeamChatStack";
import { teamChatSeedHash } from "../../teamChat/TeamChatSeedSync";

function synth(envName: "TEST" | "PROD"): Template {
  const stack = new Nyc311TeamChatStack(new App(), "Nyc311TeamChatStack", {
    env: { account: "123456789012", region: "us-east-1" },
    envName,
    stackName: `Nyc311TeamChat-${envName === "TEST" ? "Test" : "Prod"}`,
    seedHash: "fixed",
  });
  return Template.fromStack(stack);
}

let test: Template;
let prod: Template;

beforeAll(() => {
  test = synth("TEST");
  prod = synth("PROD");
});

describe("Nyc311TeamChatStack", () => {
  it("creates the one table with pk/sk, a TTL and a stream, retained and protected in Prod only", () => {
    prod.hasResourceProperties("AWS::DynamoDB::GlobalTable", {
      TableName: "TeamChat-Prod",
      KeySchema: [
        { AttributeName: "pk", KeyType: "HASH" },
        { AttributeName: "sk", KeyType: "RANGE" },
      ],
      TimeToLiveSpecification: { AttributeName: "expires_at", Enabled: true },
      StreamSpecification: { StreamViewType: "NEW_AND_OLD_IMAGES" },
      Replicas: [Match.objectLike({ DeletionProtectionEnabled: true, PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true } })],
    });
    prod.hasResource("AWS::DynamoDB::GlobalTable", { DeletionPolicy: "Retain" });
    test.hasResource("AWS::DynamoDB::GlobalTable", { DeletionPolicy: "Delete" });
  });

  it("names the API and seed-sync Lambdas per environment", () => {
    for (const name of ["TeamChatApi-Test", "TeamChatSeedSync-Test"]) {
      test.hasResourceProperties("AWS::Lambda::Function", { FunctionName: name });
    }
    test.hasResourceProperties("AWS::Lambda::Function", { FunctionName: "TeamChatSeedSync-Test", Environment: { Variables: Match.objectLike({ TEAM_CHAT_ENV: "TEST" }) } });
    test.hasResourceProperties("Custom::TeamChatSeedSync", { SeedHash: "fixed" });
  });

  it("routes every read open and every member route through the JWT authorizer", () => {
    const routes = test.findResources("AWS::ApiGatewayV2::Route");
    const byKey = new Map(Object.values(routes).map((route) => [route.Properties.RouteKey as string, route.Properties as { AuthorizationType?: string }]));
    for (const key of TEAM_CHAT_READ_ROUTES) expect(byKey.get(key)?.AuthorizationType ?? "NONE").toBe("NONE");
    for (const key of TEAM_CHAT_MEMBER_ROUTES) expect(byKey.get(key)?.AuthorizationType).toBe("JWT");
    expect(byKey.size).toBe(TEAM_CHAT_READ_ROUTES.length + TEAM_CHAT_MEMBER_ROUTES.length);
  });

  it("reads the admin pool from SSM, never an import", () => {
    const [authorizer] = Object.values(test.findResources("AWS::ApiGatewayV2::Authorizer"));
    expect(authorizer.Properties.AuthorizerType).toBe("JWT");
    expect(authorizer.Properties.JwtConfiguration.Audience).toHaveLength(2);
    const json = JSON.stringify(test.toJSON());
    expect(json).not.toContain("Fn::ImportValue");
    expect(json).toContain("/Nyc311/Test/AdminPool/UserPoolId");
    expect(json).toContain("/Nyc311/Test/AdminPool/AgentClientId");
  });

  it("serves chat-api on its own domain, throttled, with CORS for the site", () => {
    prod.hasResourceProperties("AWS::ApiGatewayV2::DomainName", { DomainName: "chat-api.boroughsim.com" });
    test.hasResourceProperties("AWS::ApiGatewayV2::DomainName", { DomainName: "chat-api.test.boroughsim.com" });
    test.hasResourceProperties("AWS::ApiGatewayV2::Stage", { DefaultRouteSettings: { ThrottlingRateLimit: 10, ThrottlingBurstLimit: 20 } });
    test.hasResourceProperties("AWS::ApiGatewayV2::Api", { Name: "Nyc311TeamChatApi-Test", CorsConfiguration: Match.objectLike({ AllowOrigins: ["https://test.boroughsim.com", "http://localhost:5173"] }) });
    test.hasOutput("TeamChatApiUrl", { Value: "https://chat-api.test.boroughsim.com" });
  });

  it("alarms on 429s and 5xx from the router's log line", () => {
    test.hasResourceProperties("AWS::Logs::MetricFilter", { FilterPattern: '{ $.message = "TeamChatApiRouterCompleted" && $.statusCode = 429 }' });
    test.hasResourceProperties("AWS::Logs::MetricFilter", { FilterPattern: '{ $.message = "TeamChatApiRouterCompleted" && $.statusCode >= 500 }' });
    for (const name of ["Nyc311TeamChatRateLimited-Test", "Nyc311TeamChatServerErrors-Test"]) {
      test.hasResourceProperties("AWS::CloudWatch::Alarm", { AlarmName: name });
    }
    test.hasResourceProperties("AWS::SNS::Subscription", { Protocol: "email" });
  });

  it("grants the API Lambda only its own table", () => {
    const policies = test.findResources("AWS::IAM::Policy");
    const actions = Object.values(policies).flatMap((policy) => (policy.Properties.PolicyDocument.Statement as { Action: string | string[] }[]).flatMap((s) => s.Action));
    expect(actions.filter((action) => action.startsWith("dynamodb:Scan") || action === "dynamodb:*")).toEqual([]);
  });
});

describe("teamChatSeedHash", () => {
  it("is a stable sha256 of the seed sources", () => {
    expect(teamChatSeedHash()).toMatch(/^[0-9a-f]{64}$/);
    expect(teamChatSeedHash()).toBe(teamChatSeedHash());
  });
});
