import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import { describe, expect, it } from "vitest";
import { CustomerApi } from "../../customer/CustomerApi";
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
  new CustomerApi(stack, "CustomerApi", { webhookListenerLambda, apiDomainName });
  return Template.fromStack(stack);
}

describe("CustomerApi", () => {
  it("is its own HTTP API, mapped to the customer's domain", () => {
    const template = synthesize();
    template.hasResourceProperties("AWS::ApiGatewayV2::Api", { Name: "Nyc311CustomerApi-Prod", ProtocolType: "HTTP" });
    template.resourceCountIs("AWS::ApiGatewayV2::Api", 1);
    template.hasResourceProperties("AWS::ApiGatewayV2::ApiMapping", { DomainName: "customer-api.boroughsim.com" });
  });

  it("has exactly one route, the webhook listener, with no authorizer — the signature authenticates", () => {
    const template = synthesize();
    template.resourceCountIs("AWS::ApiGatewayV2::Route", 1);
    template.hasResourceProperties("AWS::ApiGatewayV2::Route", { RouteKey: "POST /webhooks/bureau", AuthorizationType: "NONE" });
    template.hasResourceProperties("AWS::ApiGatewayV2::Integration", { IntegrationType: "AWS_PROXY", PayloadFormatVersion: "2.0" });
  });

  it("throttles the stage, with its own limit on the webhook route, and the stage depends on that route", () => {
    const template = synthesize();
    template.hasResourceProperties("AWS::ApiGatewayV2::Stage", {
      StageName: "$default",
      DefaultRouteSettings: { ThrottlingRateLimit: 10, ThrottlingBurstLimit: 20 },
      RouteSettings: { "POST /webhooks/bureau": { ThrottlingRateLimit: 5, ThrottlingBurstLimit: 10 } },
    });
    const [stage] = Object.values(template.findResources("AWS::ApiGatewayV2::Stage"));
    const [routeId] = Object.keys(template.findResources("AWS::ApiGatewayV2::Route"));
    expect(stage.DependsOn).toContain(routeId);
  });
});
