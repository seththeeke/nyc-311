import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import { describe, expect, it } from "vitest";
import { CustomerApi } from "../../customer/CustomerApi";
import { CustomerReadApiLambda } from "../../customer/CustomerReadApiLambda";
import { ResidentIdeasTable } from "../../customer/ResidentIdeasTable";
import { ResidentsTable } from "../../customer/ResidentsTable";
import { CustomerWebhookListenerLambda } from "../../customer/CustomerWebhookListenerLambda";
import { WebhookCustomerFacingOrdersTable } from "../../customer/WebhookCustomerFacingOrdersTable";

function synthesize(): Template {
  const stack = new Stack(new App(), "TestStack", { env: { region: "us-east-1" } });
  const ordersTable = new WebhookCustomerFacingOrdersTable(stack, "WebhookCustomerFacingOrdersTable");
  const webhookListenerLambda = new CustomerWebhookListenerLambda(stack, "CustomerWebhookListenerLambda", { ordersTable });
  const apiDomainName = apigwv2.DomainName.fromDomainNameAttributes(stack, "ApiDomainName", {
    name: "customer-api.boroughsim.com",
    regionalDomainName: "d-abc123.execute-api.us-east-1.amazonaws.com",
    regionalHostedZoneId: "Z1UJRXOUMOOFR7",
  });
  const readApiLambda = new CustomerReadApiLambda(stack, "CustomerReadApiLambda", {
    residentsTable: new ResidentsTable(stack, "ResidentsTable"),
    ideasTable: new ResidentIdeasTable(stack, "ResidentIdeasTable"),
    ordersTable,
  });
  new CustomerApi(stack, "CustomerApi", { webhookListenerLambda, readApiLambda, apiDomainName });
  return Template.fromStack(stack);
}

describe("CustomerApi", () => {
  it("is its own HTTP API, mapped to the customer's domain", () => {
    const template = synthesize();
    template.hasResourceProperties("AWS::ApiGatewayV2::Api", { Name: "Nyc311CustomerApi-Prod", ProtocolType: "HTTP" });
    template.resourceCountIs("AWS::ApiGatewayV2::Api", 1);
    template.hasResourceProperties("AWS::ApiGatewayV2::ApiMapping", { DomainName: "customer-api.boroughsim.com" });
  });

  it("has the webhook route plus the five public read routes, none with an authorizer", () => {
    const template = synthesize();
    const routeKeys = Object.values(template.findResources("AWS::ApiGatewayV2::Route")).map((route) => route.Properties.RouteKey).sort();
    expect(routeKeys).toEqual([
      "GET /ideas",
      "GET /residents",
      "GET /residents/{personaId}",
      "GET /residents/{personaId}/ideas",
      "GET /residents/{personaId}/ideas/{ideaId}",
      "POST /webhooks/bureau",
    ]);
    template.hasResourceProperties("AWS::ApiGatewayV2::Route", { RouteKey: "POST /webhooks/bureau", AuthorizationType: "NONE" });
    template.resourceCountIs("AWS::ApiGatewayV2::Integration", 2);
    template.hasResourceProperties("AWS::ApiGatewayV2::Integration", { IntegrationType: "AWS_PROXY", PayloadFormatVersion: "2.0" });
  });

  it("allows GETs from BoroughSim's sites and the local dev server", () => {
    synthesize().hasResourceProperties("AWS::ApiGatewayV2::Api", {
      CorsConfiguration: {
        AllowOrigins: ["https://boroughsim.com", "https://test.boroughsim.com", "http://localhost:5173"],
        AllowMethods: ["GET"],
        MaxAge: 86400,
      },
    });
  });

  it("throttles the stage, with its own limit on the webhook route, and the stage depends on that route", () => {
    const template = synthesize();
    template.hasResourceProperties("AWS::ApiGatewayV2::Stage", {
      StageName: "$default",
      DefaultRouteSettings: { ThrottlingRateLimit: 10, ThrottlingBurstLimit: 20 },
      RouteSettings: { "POST /webhooks/bureau": { ThrottlingRateLimit: 5, ThrottlingBurstLimit: 10 } },
    });
    const [stage] = Object.values(template.findResources("AWS::ApiGatewayV2::Stage"));
    const [routeId] = Object.entries(template.findResources("AWS::ApiGatewayV2::Route")).find(([, route]) => route.Properties.RouteKey === "POST /webhooks/bureau") ?? [];
    expect(stage.DependsOn).toContain(routeId);
  });
});
