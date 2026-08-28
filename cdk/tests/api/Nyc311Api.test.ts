import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { describe, it } from "vitest";
import { RequestsTable } from "../../data/RequestsTable";
import { OrdersTable } from "../../data/OrdersTable";
import { Nyc311MetricsApiLambda } from "../../lambda/Nyc311MetricsApiLambda";
import { Nyc311OrdersApiLambda } from "../../lambda/Nyc311OrdersApiLambda";
import { Nyc311OrderEventsApiLambda } from "../../lambda/Nyc311OrderEventsApiLambda";
import { Nyc311LambdaMetricsApiLambda } from "../../lambda/Nyc311LambdaMetricsApiLambda";
import { Nyc311Api } from "../../api/Nyc311Api";

const WEB_APP_DOMAIN = "d123456abcdef.cloudfront.net";

function synthesize(envName: "TEST" | "PROD"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  const requestsTable = new RequestsTable(stack, "RequestsTable", { envName });
  const ordersTable = new OrdersTable(stack, "OrdersTable", { envName });
  const metricsApiLambda = new Nyc311MetricsApiLambda(stack, "Nyc311MetricsApiLambda", { envName, requestsTable });
  const ordersApiLambda = new Nyc311OrdersApiLambda(stack, "Nyc311OrdersApiLambda", { envName, ordersTable });
  const orderEventsApiLambda = new Nyc311OrderEventsApiLambda(stack, "Nyc311OrderEventsApiLambda", {
    envName,
    ordersTable,
  });
  const lambdaMetricsApiLambda = new Nyc311LambdaMetricsApiLambda(stack, "Nyc311LambdaMetricsApiLambda", {
    envName,
    pollerFunctionName: "Nyc311Poller-Test",
    orderFanOutFunctionName: "Nyc311OrderFanOut-Test",
    requestEvaluationFunctionName: "Nyc311RequestEvaluation-Test",
    orderEventFanOutFunctionName: "Nyc311OrderEventFanOut-Test",
    orderEvaluationFunctionName: "Nyc311OrderEvaluation-Test",
    orderSchedulingFunctionName: "Nyc311OrderScheduling-Test",
    metricsApiFunctionName: "Nyc311MetricsApi-Test",
    ordersApiFunctionName: "Nyc311OrdersApi-Test",
    orderEventsApiFunctionName: "Nyc311OrderEventsApi-Test",
  });
  new Nyc311Api(stack, "Nyc311Api", {
    envName,
    metricsApiLambda,
    ordersApiLambda,
    orderEventsApiLambda,
    lambdaMetricsApiLambda,
    webAppDomainName: WEB_APP_DOMAIN,
  });
  return Template.fromStack(stack);
}

describe("Nyc311Api", () => {
  it("is an HTTP API (apigatewayv2), not a REST API, suffixed by environment", () => {
    synthesize("TEST").hasResourceProperties("AWS::ApiGatewayV2::Api", {
      Name: "Nyc311Api-Test",
      ProtocolType: "HTTP",
    });
    synthesize("PROD").hasResourceProperties("AWS::ApiGatewayV2::Api", {
      Name: "Nyc311Api-Prod",
      ProtocolType: "HTTP",
    });
  });

  it("allows CORS only from the web-app's CloudFront domain and local dev, GET only", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::ApiGatewayV2::Api", {
      CorsConfiguration: {
        AllowOrigins: [`https://${WEB_APP_DOMAIN}`, "http://localhost:5173"],
        AllowMethods: ["GET"],
      },
    });
  });

  it("wires GET /ingestion/metrics to the metrics Lambda", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::ApiGatewayV2::Route", {
      RouteKey: "GET /ingestion/metrics",
    });
    template.resourceCountIs("AWS::ApiGatewayV2::Integration", 4);
    template.hasResourceProperties("AWS::ApiGatewayV2::Integration", {
      IntegrationType: "AWS_PROXY",
      PayloadFormatVersion: "2.0",
    });
  });

  it("wires GET /orders to the orders Lambda", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::ApiGatewayV2::Route", {
      RouteKey: "GET /orders",
    });
  });

  it("wires GET /order-events to the order-events Lambda", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::ApiGatewayV2::Route", {
      RouteKey: "GET /order-events",
    });
  });

  it("wires GET /lambda-metrics to the Lambda-metrics Lambda", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::ApiGatewayV2::Route", {
      RouteKey: "GET /lambda-metrics",
    });
  });

  it("declares exactly four routes — the only public endpoints today", () => {
    const template = synthesize("TEST");
    template.resourceCountIs("AWS::ApiGatewayV2::Route", 4);
  });
});
