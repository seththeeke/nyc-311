import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import { beforeAll, describe, expect, it } from "vitest";
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
import { UsersTable } from "../../data/UsersTable";
import { Nyc311AdminAuth } from "../../auth/Nyc311AdminAuth";
import { Nyc311AdminWhoamiApiLambda } from "../../lambda/Nyc311AdminWhoamiApiLambda";
import { OperatorsTable } from "../../data/OperatorsTable";
import { Nyc311AddCapacityApiLambda } from "../../lambda/Nyc311AddCapacityApiLambda";
import { Nyc311RemoveCapacityApiLambda } from "../../lambda/Nyc311RemoveCapacityApiLambda";
import { Nyc311GetCapacityApiLambda } from "../../lambda/Nyc311GetCapacityApiLambda";
import { Nyc311Api } from "../../api/Nyc311Api";

const SITE_DOMAIN = "test.boroughsim.com";
const CLOUDFRONT_DOMAIN = "d123456abcdef.cloudfront.net";

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
  const usersTable = new UsersTable(stack, "UsersTable", { envName });
  const adminAuth = new Nyc311AdminAuth(stack, "Nyc311AdminAuth", { envName });
  const adminWhoamiApiLambda = new Nyc311AdminWhoamiApiLambda(stack, "Nyc311AdminWhoamiApiLambda", {
    envName,
    usersTable,
  });
  const operatorsTable = new OperatorsTable(stack, "OperatorsTable", { envName });
  const addCapacityApiLambda = new Nyc311AddCapacityApiLambda(stack, "Nyc311AddCapacityApiLambda", {
    envName,
    operatorsTable,
    usersTable,
  });
  const removeCapacityApiLambda = new Nyc311RemoveCapacityApiLambda(stack, "Nyc311RemoveCapacityApiLambda", {
    envName,
    operatorsTable,
    usersTable,
  });
  const getCapacityApiLambda = new Nyc311GetCapacityApiLambda(stack, "Nyc311GetCapacityApiLambda", {
    envName,
    operatorsTable,
    usersTable,
  });
  const apiDomainName = apigwv2.DomainName.fromDomainNameAttributes(stack, "ApiDomainName", {
    name: "api.test.boroughsim.com",
    regionalDomainName: "d-abc123.execute-api.us-east-1.amazonaws.com",
    regionalHostedZoneId: "Z1UJRXOUMOOFR7",
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
    adminWhoamiApiLambda,
    addCapacityApiLambda,
    removeCapacityApiLambda,
    getCapacityApiLambda,
    adminAuthorizer: adminAuth.authorizer,
    webAppDomainNames: [SITE_DOMAIN, CLOUDFRONT_DOMAIN],
    apiDomainName,
  });
  return Template.fromStack(stack);
}

describe("Nyc311Api", () => {
  /*
   * synthesize() bundles ~12 Lambdas with esbuild — calling it once per
   * `it()` (14x) made this file the dominant cost of its CI shard (each
   * call ~2s locally, enough on CodeBuild's slower compute to blow past
   * Vitest's 60s worker-RPC ceiling). One synth per environment, cached
   * here, mirrors tests/stack/Nyc311Stack.test.ts's existing pattern.
   */
  let testTemplate: Template;
  let prodTemplate: Template;

  beforeAll(() => {
    testTemplate = synthesize("TEST");
    prodTemplate = synthesize("PROD");
  });

  it("is an HTTP API (apigatewayv2), not a REST API, suffixed by environment", () => {
    testTemplate.hasResourceProperties("AWS::ApiGatewayV2::Api", {
      Name: "Nyc311Api-Test",
      ProtocolType: "HTTP",
    });
    prodTemplate.hasResourceProperties("AWS::ApiGatewayV2::Api", {
      Name: "Nyc311Api-Prod",
      ProtocolType: "HTTP",
    });
  });

  it("allows CORS from the custom site domain, the CloudFront default, and local dev", () => {
    testTemplate.hasResourceProperties("AWS::ApiGatewayV2::Api", {
      CorsConfiguration: Match.objectLike({
        AllowOrigins: [`https://${SITE_DOMAIN}`, `https://${CLOUDFRONT_DOMAIN}`, "http://localhost:5173"],
      }),
    });
  });

  it("maps the API's custom domain as the default domain", () => {
    testTemplate.hasResourceProperties("AWS::ApiGatewayV2::ApiMapping", {
      DomainName: "api.test.boroughsim.com",
    });
  });

  it("wires GET /ingestion/metrics to the metrics Lambda", () => {
    testTemplate.hasResourceProperties("AWS::ApiGatewayV2::Route", {
      RouteKey: "GET /ingestion/metrics",
    });
    testTemplate.resourceCountIs("AWS::ApiGatewayV2::Integration", 12);
    testTemplate.hasResourceProperties("AWS::ApiGatewayV2::Integration", {
      IntegrationType: "AWS_PROXY",
      PayloadFormatVersion: "2.0",
    });
  });

  it("wires GET /orders to the orders Lambda", () => {
    testTemplate.hasResourceProperties("AWS::ApiGatewayV2::Route", {
      RouteKey: "GET /orders",
    });
  });

  it("wires GET /order-events to the order-events Lambda", () => {
    testTemplate.hasResourceProperties("AWS::ApiGatewayV2::Route", {
      RouteKey: "GET /order-events",
    });
  });

  it("wires GET /lambda-metrics to the Lambda-metrics Lambda", () => {
    testTemplate.hasResourceProperties("AWS::ApiGatewayV2::Route", {
      RouteKey: "GET /lambda-metrics",
    });
  });

  it("wires the three GET /data/* warehouse routes", () => {
    for (const routeKey of ["GET /data/schema", "GET /data/jobs", "GET /data/jobs/{name}/result"]) {
      testTemplate.hasResourceProperties("AWS::ApiGatewayV2::Route", { RouteKey: routeKey });
    }
  });

  it("wires GET /reports to the reports Lambda", () => {
    testTemplate.hasResourceProperties("AWS::ApiGatewayV2::Route", {
      RouteKey: "GET /reports",
    });
  });

  it("wires GET /admin/whoami to the admin-whoami Lambda, behind the JWT authorizer", () => {
    testTemplate.hasResourceProperties("AWS::ApiGatewayV2::Route", {
      RouteKey: "GET /admin/whoami",
      AuthorizationType: "JWT",
    });
  });

  it("wires POST /capacity, DELETE /capacity/{operator_id}, and GET /capacity, all behind the JWT authorizer", () => {
    for (const routeKey of ["POST /capacity", "DELETE /capacity/{operator_id}", "GET /capacity"]) {
      testTemplate.hasResourceProperties("AWS::ApiGatewayV2::Route", { RouteKey: routeKey, AuthorizationType: "JWT" });
    }
  });

  it("does not attach the JWT authorizer to any other route", () => {
    const routes = testTemplate.findResources("AWS::ApiGatewayV2::Route");
    const authorizedRouteKeys = Object.values(routes)
      .filter((route) => route.Properties?.AuthorizationType === "JWT")
      .map((route) => route.Properties?.RouteKey)
      .sort();
    expect(authorizedRouteKeys).toEqual(
      ["GET /admin/whoami", "GET /capacity", "POST /capacity", "DELETE /capacity/{operator_id}"].sort()
    );
  });

  it("allows POST and DELETE in CORS, alongside GET", () => {
    testTemplate.hasResourceProperties("AWS::ApiGatewayV2::Api", {
      CorsConfiguration: Match.objectLike({
        AllowMethods: Match.arrayWith(["GET", "POST", "DELETE"]),
      }),
    });
  });

  it("declares exactly twelve routes today", () => {
    testTemplate.resourceCountIs("AWS::ApiGatewayV2::Route", 12);
  });
});
