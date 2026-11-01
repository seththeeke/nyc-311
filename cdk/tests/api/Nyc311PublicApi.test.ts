import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import * as route53 from "aws-cdk-lib/aws-route53";
import { beforeAll, describe, expect, it } from "vitest";
import { PUBLIC_V1_API_ROUTES } from "../../../backend/controller/web-api/publicV1/publicV1ApiRoutes";
import { Nyc311ApiDomain } from "../../api/Nyc311ApiDomain";
import { Nyc311PublicApi, PUBLIC_API_DEFAULT_THROTTLE, PUBLIC_API_ROUTE_THROTTLES } from "../../api/Nyc311PublicApi";
import { ContactsTable } from "../../data/ContactsTable";
import { Nyc311PublicApiCallsTopic } from "../../lambda/Nyc311PublicApiCallsTopic";
import { LocationsTable } from "../../data/LocationsTable";
import { OrdersTable } from "../../data/OrdersTable";
import { Nyc311PublicApiLambda } from "../../lambda/Nyc311PublicApiLambda";

function synthesize(envName: "TEST" | "PROD"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  const hostedZone = route53.PublicHostedZone.fromHostedZoneAttributes(stack, "HostedZone", {
    hostedZoneId: "Z0123456789ABCDEFGHIJ",
    zoneName: "boroughsim.com",
  });
  const domain = new Nyc311ApiDomain(stack, "Nyc311PublicApiDomain", {
    envName,
    apiDomain: envName === "PROD" ? "public-api.boroughsim.com" : "public-api.test.boroughsim.com",
    hostedZone,
  });
  new Nyc311PublicApi(stack, "Nyc311PublicApi", {
    envName,
    publicApiLambda: new Nyc311PublicApiLambda(stack, "Nyc311PublicApiLambda", {
      envName,
      ordersTable: new OrdersTable(stack, "OrdersTable", { envName }),
      locationsTable: new LocationsTable(stack, "LocationsTable", { envName }),
    contactsTable: new ContactsTable(stack, "ContactsTable", { envName }),
    publicApiCallsTopic: new Nyc311PublicApiCallsTopic(stack, "Nyc311PublicApiCallsTopic", { envName }).topic,
    }),
    publicApiDomainName: domain.domainName,
  });
  return Template.fromStack(stack);
}

describe("Nyc311PublicApi", () => {
  let template: Template;

  beforeAll(() => {
    template = synthesize("TEST");
  });

  it("is its own HTTP API, suffixed by environment", () => {
    template.hasResourceProperties("AWS::ApiGatewayV2::Api", { Name: "Nyc311PublicApi-Test", ProtocolType: "HTTP" });
    synthesize("PROD").hasResourceProperties("AWS::ApiGatewayV2::Api", { Name: "Nyc311PublicApi-Prod" });
  });

  it("allows any origin and the public headers, and exposes X-Call-Id", () => {
    template.hasResourceProperties("AWS::ApiGatewayV2::Api", {
      CorsConfiguration: {
        AllowOrigins: ["*"],
        AllowMethods: ["GET", "POST"],
        AllowHeaders: ["Content-Type", "X-Requester", "Idempotency-Key"],
        ExposeHeaders: ["X-Call-Id"],
      },
    });
  });

  it("creates every /v1/ route, all on one integration, with no authorizer", () => {
    const routes = Object.values(template.findResources("AWS::ApiGatewayV2::Route")).map((r) => r.Properties as Record<string, unknown>);
    expect(routes.map((r) => r.RouteKey).sort()).toEqual([...PUBLIC_V1_API_ROUTES].sort());
    for (const route of routes) expect(route.AuthorizationType ?? "NONE").toBe("NONE");
    template.resourceCountIs("AWS::ApiGatewayV2::Integration", 1);
    template.resourceCountIs("AWS::Lambda::Permission", 1);
  });

  it("maps the public domain and throttles the stage, tighter on feature-request creation", () => {
    template.hasResourceProperties("AWS::ApiGatewayV2::ApiMapping", { DomainName: { Ref: Match.stringLikeRegexp("^Nyc311PublicApiDomain") } });
    template.hasResourceProperties("AWS::ApiGatewayV2::Stage", {
      DefaultRouteSettings: {
        ThrottlingRateLimit: PUBLIC_API_DEFAULT_THROTTLE.rateLimit,
        ThrottlingBurstLimit: PUBLIC_API_DEFAULT_THROTTLE.burstLimit,
      },
      RouteSettings: {
        "POST /v1/feature-requests": {
          ThrottlingRateLimit: PUBLIC_API_ROUTE_THROTTLES["POST /v1/feature-requests"].rateLimit,
          ThrottlingBurstLimit: PUBLIC_API_ROUTE_THROTTLES["POST /v1/feature-requests"].burstLimit,
        },
      },
    });
  });
});
