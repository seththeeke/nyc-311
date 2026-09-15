import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import { beforeAll, describe, expect, it } from "vitest";
import { RequestsTable } from "../../data/RequestsTable";
import { LocationsTable } from "../../data/LocationsTable";
import { OrdersTable } from "../../data/OrdersTable";
import { Nyc311MetricsApiLambda } from "../../lambda/Nyc311MetricsApiLambda";
import { Nyc311LambdaMetricsApiLambda } from "../../lambda/Nyc311LambdaMetricsApiLambda";
import { WarehouseJobRunsTable } from "../../data/WarehouseJobRunsTable";
import { Nyc311WarehouseBucket } from "../../warehouse/Nyc311WarehouseBucket";
import { Nyc311WarehouseCatalog } from "../../warehouse/Nyc311WarehouseCatalog";
import { Nyc311WarehouseSchemaApiLambda } from "../../warehouse/Nyc311WarehouseSchemaApiLambda";
import { Nyc311WarehouseJobsApiLambda } from "../../warehouse/Nyc311WarehouseJobsApiLambda";
import { Nyc311JobResultApiLambda } from "../../warehouse/Nyc311JobResultApiLambda";
import { Nyc311ReportsApiLambda } from "../../warehouse/Nyc311ReportsApiLambda";
import { Nyc311AdHocQueryWorkgroup } from "../../warehouse/Nyc311AdHocQueryWorkgroup";
import { Nyc311AdHocQueryApiLambda } from "../../warehouse/Nyc311AdHocQueryApiLambda";
import { Nyc311AnalyticsWorkgroup } from "../../warehouse/Nyc311AnalyticsWorkgroup";
import { Nyc311WarehouseJobRunnerLambda } from "../../warehouse/Nyc311WarehouseJobRunnerLambda";
import { Nyc311WarehouseJobScheduleGroup } from "../../warehouse/Nyc311WarehouseJobScheduleGroup";
import { Nyc311CreateWarehouseJobApiLambda } from "../../warehouse/Nyc311CreateWarehouseJobApiLambda";
import { Nyc311DeleteWarehouseJobApiLambda } from "../../warehouse/Nyc311DeleteWarehouseJobApiLambda";
import { Nyc311ListWarehouseJobsApiLambda } from "../../warehouse/Nyc311ListWarehouseJobsApiLambda";
import { UsersTable } from "../../data/UsersTable";
import { Nyc311AdminAuth } from "../../auth/Nyc311AdminAuth";
import { Nyc311AdminWhoamiApiLambda } from "../../lambda/Nyc311AdminWhoamiApiLambda";
import { OperatorsTable } from "../../data/OperatorsTable";
import { Nyc311AddCapacityApiLambda } from "../../lambda/Nyc311AddCapacityApiLambda";
import { Nyc311RemoveCapacityApiLambda } from "../../lambda/Nyc311RemoveCapacityApiLambda";
import { Nyc311GetCapacityApiLambda } from "../../lambda/Nyc311GetCapacityApiLambda";
import { Nyc311RunSchedulingApiLambda } from "../../lambda/Nyc311RunSchedulingApiLambda";
import { Nyc311GetFleetLocationsApiLambda } from "../../lambda/Nyc311GetFleetLocationsApiLambda";
import { Nyc311Api } from "../../api/Nyc311Api";

const SITE_DOMAIN = "test.boroughsim.com";
const CLOUDFRONT_DOMAIN = "d123456abcdef.cloudfront.net";

function synthesize(envName: "TEST" | "PROD"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  const requestsTable = new RequestsTable(stack, "RequestsTable", { envName });
  const ordersTable = new OrdersTable(stack, "OrdersTable", { envName });
  const metricsApiLambda = new Nyc311MetricsApiLambda(stack, "Nyc311MetricsApiLambda", { envName, requestsTable });
  const lambdaMetricsApiLambda = new Nyc311LambdaMetricsApiLambda(stack, "Nyc311LambdaMetricsApiLambda", {
    envName,
    pollerFunctionName: "Nyc311Poller-Test",
    orderFanOutFunctionName: "Nyc311RequestsFanOut-Test",
    locationsFanOutFunctionName: "Nyc311LocationsFanOut-Test",
    operatorsFanOutFunctionName: "Nyc311OperatorsStreamFanOut-Test",
    requestEvaluationFunctionName: "Nyc311RequestEvaluation-Test",
    orderEventFanOutFunctionName: "Nyc311OrdersStreamFanOut-Test",
    orderEvaluationFunctionName: "Nyc311OrderEvaluation-Test",
    orderSchedulingFunctionName: "Nyc311OrderScheduling-Test",
    metricsApiFunctionName: "Nyc311MetricsApi-Test",
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
  const locationsTable = new LocationsTable(stack, "LocationsTable", { envName });
  /*
   * Referenced by ARN, not the real construct — the real state machine
   * pulls in Nyc311OrderExecutionLambda, and this file already bundles
   * ~12 Lambdas with esbuild once per environment (see the CI-cost note
   * on the describe block below); a fake ARN keeps that count from
   * growing further for a route-wiring test that has no reason to care
   * what's on the other end of it.
   */
  const orderExecutionStateMachine = sfn.StateMachine.fromStateMachineArn(
    stack,
    "FakeOrderExecutionStateMachine",
    "arn:aws:states:us-east-1:123456789012:stateMachine:Fake"
  );
  const runSchedulingApiLambda = new Nyc311RunSchedulingApiLambda(stack, "Nyc311RunSchedulingApiLambda", {
    envName,
    ordersTable,
    requestsTable,
    locationsTable,
    operatorsTable,
    usersTable,
    orderExecutionStateMachine,
  });
  const getFleetLocationsApiLambda = new Nyc311GetFleetLocationsApiLambda(stack, "Nyc311GetFleetLocationsApiLambda", {
    envName,
    operatorsTable,
  });
  const adHocQueryWorkgroup = new Nyc311AdHocQueryWorkgroup(stack, "Nyc311AdHocQueryWorkgroup", {
    envName,
    warehouseBucket,
  });
  const adHocQueryApiLambda = new Nyc311AdHocQueryApiLambda(stack, "Nyc311AdHocQueryApiLambda", {
    envName,
    warehouseBucket,
    warehouseCatalog,
    adHocQueryWorkgroup,
    usersTable,
  });
  const analyticsWorkgroup = new Nyc311AnalyticsWorkgroup(stack, "Nyc311AnalyticsWorkgroup", { envName, warehouseBucket });
  const warehouseJobRunnerLambda = new Nyc311WarehouseJobRunnerLambda(stack, "Nyc311WarehouseJobRunnerLambda", {
    envName,
    jobRunsTable: warehouseJobRunsTable,
    warehouseBucket,
    warehouseCatalog,
    analyticsWorkgroup,
  });
  const warehouseJobScheduleGroup = new Nyc311WarehouseJobScheduleGroup(stack, "Nyc311WarehouseJobScheduleGroup", {
    envName,
    jobRunnerLambda: warehouseJobRunnerLambda,
    failureNotificationEmail: "ops@example.com",
  });
  const createWarehouseJobApiLambda = new Nyc311CreateWarehouseJobApiLambda(stack, "Nyc311CreateWarehouseJobApiLambda", {
    envName,
    jobRunsTable: warehouseJobRunsTable,
    usersTable,
    warehouseBucket,
    jobRunnerLambda: warehouseJobRunnerLambda,
    jobScheduleGroup: warehouseJobScheduleGroup,
  });
  const deleteWarehouseJobApiLambda = new Nyc311DeleteWarehouseJobApiLambda(stack, "Nyc311DeleteWarehouseJobApiLambda", {
    envName,
    jobRunsTable: warehouseJobRunsTable,
    usersTable,
    warehouseBucket,
    jobRunnerLambda: warehouseJobRunnerLambda,
    jobScheduleGroup: warehouseJobScheduleGroup,
  });
  const listWarehouseJobsApiLambda = new Nyc311ListWarehouseJobsApiLambda(stack, "Nyc311ListWarehouseJobsApiLambda", {
    envName,
    jobRunsTable: warehouseJobRunsTable,
    usersTable,
    warehouseBucket,
    jobRunnerLambda: warehouseJobRunnerLambda,
    jobScheduleGroup: warehouseJobScheduleGroup,
  });
  const apiDomainName = apigwv2.DomainName.fromDomainNameAttributes(stack, "ApiDomainName", {
    name: "api.test.boroughsim.com",
    regionalDomainName: "d-abc123.execute-api.us-east-1.amazonaws.com",
    regionalHostedZoneId: "Z1UJRXOUMOOFR7",
  });
  new Nyc311Api(stack, "Nyc311Api", {
    envName,
    metricsApiLambda,
    lambdaMetricsApiLambda,
    warehouseSchemaApiLambda,
    warehouseJobsApiLambda,
    jobResultApiLambda,
    reportsApiLambda,
    adminWhoamiApiLambda,
    addCapacityApiLambda,
    removeCapacityApiLambda,
    getCapacityApiLambda,
    runSchedulingApiLambda,
    getFleetLocationsApiLambda,
    adHocQueryApiLambda,
    createWarehouseJobApiLambda,
    deleteWarehouseJobApiLambda,
    listWarehouseJobsApiLambda,
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
    testTemplate.resourceCountIs("AWS::ApiGatewayV2::Integration", 16);
    testTemplate.hasResourceProperties("AWS::ApiGatewayV2::Integration", {
      IntegrationType: "AWS_PROXY",
      PayloadFormatVersion: "2.0",
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

  it("wires POST /scheduling/run to the run-scheduling Lambda, behind the JWT authorizer", () => {
    testTemplate.hasResourceProperties("AWS::ApiGatewayV2::Route", {
      RouteKey: "POST /scheduling/run",
      AuthorizationType: "JWT",
    });
  });

  it("wires POST /admin/warehouse/query to the ad-hoc query Lambda, behind the JWT authorizer", () => {
    testTemplate.hasResourceProperties("AWS::ApiGatewayV2::Route", {
      RouteKey: "POST /admin/warehouse/query",
      AuthorizationType: "JWT",
    });
  });

  it("wires POST/GET /admin/warehouse/jobs and DELETE /admin/warehouse/jobs/{name}, behind the JWT authorizer", () => {
    for (const [method, path] of [
      ["POST", "/admin/warehouse/jobs"],
      ["GET", "/admin/warehouse/jobs"],
      ["DELETE", "/admin/warehouse/jobs/{name}"],
    ]) {
      testTemplate.hasResourceProperties("AWS::ApiGatewayV2::Route", {
        RouteKey: `${method} ${path}`,
        AuthorizationType: "JWT",
      });
    }
  });

  it("wires GET /fleet/locations to the fleet-locations Lambda, no authorizer — public, unlike /capacity", () => {
    testTemplate.hasResourceProperties("AWS::ApiGatewayV2::Route", {
      RouteKey: "GET /fleet/locations",
      AuthorizationType: "NONE",
    });
  });

  it("does not attach the JWT authorizer to any other route", () => {
    const routes = testTemplate.findResources("AWS::ApiGatewayV2::Route");
    const authorizedRouteKeys = Object.values(routes)
      .filter((route) => route.Properties?.AuthorizationType === "JWT")
      .map((route) => route.Properties?.RouteKey)
      .sort();
    expect(authorizedRouteKeys).toEqual(
      [
        "GET /admin/whoami",
        "GET /capacity",
        "POST /capacity",
        "DELETE /capacity/{operator_id}",
        "POST /scheduling/run",
        "POST /admin/warehouse/query",
        "POST /admin/warehouse/jobs",
        "GET /admin/warehouse/jobs",
        "DELETE /admin/warehouse/jobs/{name}",
      ].sort()
    );
  });

  it("allows POST and DELETE in CORS, alongside GET", () => {
    testTemplate.hasResourceProperties("AWS::ApiGatewayV2::Api", {
      CorsConfiguration: Match.objectLike({
        AllowMethods: Match.arrayWith(["GET", "POST", "DELETE"]),
      }),
    });
  });

  it("declares exactly sixteen routes today", () => {
    testTemplate.resourceCountIs("AWS::ApiGatewayV2::Route", 16);
  });
});
