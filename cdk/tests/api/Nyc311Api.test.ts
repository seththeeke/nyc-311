import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { describe, it } from "vitest";
import { RequestsTable } from "../../data/RequestsTable";
import { OrdersTable } from "../../data/OrdersTable";
import { Nyc311MetricsApiLambda } from "../../lambda/Nyc311MetricsApiLambda";
import { Nyc311OrdersApiLambda } from "../../lambda/Nyc311OrdersApiLambda";
import { Nyc311OrderEventsApiLambda } from "../../lambda/Nyc311OrderEventsApiLambda";
import { Nyc311LambdaMetricsApiLambda } from "../../lambda/Nyc311LambdaMetricsApiLambda";
import { WarehouseJobRunsTable } from "../../data/WarehouseJobRunsTable";
import { Nyc311WarehouseBucket } from "../../warehouse/Nyc311WarehouseBucket";
import { Nyc311WarehouseCatalog } from "../../warehouse/Nyc311WarehouseCatalog";
import { Nyc311WarehouseSchemaApiLambda } from "../../warehouse/Nyc311WarehouseSchemaApiLambda";
import { Nyc311WarehouseJobsApiLambda } from "../../warehouse/Nyc311WarehouseJobsApiLambda";
import { Nyc311JobResultApiLambda } from "../../warehouse/Nyc311JobResultApiLambda";
import { Nyc311ReportsApiLambda } from "../../warehouse/Nyc311ReportsApiLambda";
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
    orderFanOutFunctionName: "Nyc311RequestsFanOut-Test",
    locationsFanOutFunctionName: "Nyc311LocationsFanOut-Test",
    requestEvaluationFunctionName: "Nyc311RequestEvaluation-Test",
    orderEventFanOutFunctionName: "Nyc311OrdersStreamFanOut-Test",
    orderEvaluationFunctionName: "Nyc311OrderEvaluation-Test",
    orderSchedulingFunctionName: "Nyc311OrderScheduling-Test",
    metricsApiFunctionName: "Nyc311MetricsApi-Test",
    ordersApiFunctionName: "Nyc311OrdersApi-Test",
    orderEventsApiFunctionName: "Nyc311OrderEventsApi-Test",
    warehouseJobRunnerFunctionName: "Nyc311WarehouseJobRunner-Test",
    warehouseSchemaApiFunctionName: "Nyc311WarehouseSchemaApi-Test",
    warehouseJobsApiFunctionName: "Nyc311WarehouseJobsApi-Test",
    jobResultApiFunctionName: "Nyc311JobResultApi-Test",
    reportsApiFunctionName: "Nyc311ReportsApi-Test",
  });
  const warehouseJobRunsTable = new WarehouseJobRunsTable(stack, "WarehouseJobRunsTable", { envName });
  const warehouseBucket = new Nyc311WarehouseBucket(stack, "Nyc311WarehouseBucket", { envName });
  const warehouseCatalog = new Nyc311WarehouseCatalog(stack, "Nyc311WarehouseCatalog", { envName, warehouseBucket });
  const warehouseSchemaApiLambda = new Nyc311WarehouseSchemaApiLambda(stack, "Nyc311WarehouseSchemaApiLambda", {
    envName,
    warehouseCatalog,
  });
  const warehouseJobsApiLambda = new Nyc311WarehouseJobsApiLambda(stack, "Nyc311WarehouseJobsApiLambda", {
    envName,
    jobRunsTable: warehouseJobRunsTable,
  });
  const jobResultApiLambda = new Nyc311JobResultApiLambda(stack, "Nyc311JobResultApiLambda", {
    envName,
    jobRunsTable: warehouseJobRunsTable,
    warehouseBucket,
  });
  const reportsApiLambda = new Nyc311ReportsApiLambda(stack, "Nyc311ReportsApiLambda", {
    envName,
    jobRunsTable: warehouseJobRunsTable,
    warehouseBucket,
  });
  new Nyc311Api(stack, "Nyc311Api", {
    envName,
    metricsApiLambda,
    ordersApiLambda,
    orderEventsApiLambda,
    lambdaMetricsApiLambda,
    warehouseSchemaApiLambda,
    warehouseJobsApiLambda,
    jobResultApiLambda,
    reportsApiLambda,
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
    template.resourceCountIs("AWS::ApiGatewayV2::Integration", 8);
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

  it("wires the three GET /data/* warehouse routes", () => {
    const template = synthesize("TEST");

    for (const routeKey of ["GET /data/schema", "GET /data/jobs", "GET /data/jobs/{name}/result"]) {
      template.hasResourceProperties("AWS::ApiGatewayV2::Route", { RouteKey: routeKey });
    }
  });

  it("wires GET /reports to the reports Lambda", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::ApiGatewayV2::Route", {
      RouteKey: "GET /reports",
    });
  });

  it("declares exactly eight routes — the only public endpoints today", () => {
    const template = synthesize("TEST");
    template.resourceCountIs("AWS::ApiGatewayV2::Route", 8);
  });
});
