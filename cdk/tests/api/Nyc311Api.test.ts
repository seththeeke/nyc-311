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
import { Nyc311WorkspaceMetricsApiLambda } from "../../warehouse/Nyc311WorkspaceMetricsApiLambda";
import { Nyc311AdHocQueryWorkgroup } from "../../warehouse/Nyc311AdHocQueryWorkgroup";
import { Nyc311AnalyticsWorkgroup } from "../../warehouse/Nyc311AnalyticsWorkgroup";
import { Nyc311WarehouseJobRunnerLambda } from "../../warehouse/Nyc311WarehouseJobRunnerLambda";
import { Nyc311WarehouseJobScheduleGroup } from "../../warehouse/Nyc311WarehouseJobScheduleGroup";
import { UsersTable } from "../../data/UsersTable";
import { Nyc311AdminAuth } from "../../auth/Nyc311AdminAuth";
import { OperatorsTable } from "../../data/OperatorsTable";
import { Nyc311AdminApiLambda } from "../../lambda/Nyc311AdminApiLambda";
import { Nyc311GetFleetLocationsApiLambda } from "../../lambda/Nyc311GetFleetLocationsApiLambda";
import { FeatureFlagsTable } from "../../data/FeatureFlagsTable";
import { LiveWorkspaceMetricsTable } from "../../data/LiveWorkspaceMetricsTable";
import {
  FEATURE_FLAG_API_OPERATIONS,
  Nyc311FeatureFlagApiLambda,
  type FeatureFlagApiOperation,
} from "../../lambda/Nyc311FeatureFlagApiLambda";
import { WebhookSubscriptionsTable } from "../../data/WebhookSubscriptionsTable";
import { WebhookSinkDeliveriesTable } from "../../data/WebhookSinkDeliveriesTable";
import { Nyc311RegisterWebhookSubscriptionApiLambda } from "../../lambda/Nyc311RegisterWebhookSubscriptionApiLambda";
import { Nyc311WebhookSinkOperationApiLambda } from "../../lambda/Nyc311WebhookSinkOperationApiLambda";
import { Nyc311Api, ROUTE_THROTTLES } from "../../api/Nyc311Api";
import { ADMIN_API_ROUTES } from "../../../backend/controller/web-api/admin/adminApiRoutes";

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
    workspaceMetricsApiFunctionName: "Nyc311WorkspaceMetricsApi-Test",
    fleetLocationsApiFunctionName: "Nyc311GetFleetLocationsApi-Test",
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
  const featureFlagsTable = new FeatureFlagsTable(stack, "FeatureFlagsTable", { envName });
  const liveWorkspaceMetricsTable = new LiveWorkspaceMetricsTable(stack, "LiveWorkspaceMetricsTable", { envName });
  const workspaceMetricsApiLambda = new Nyc311WorkspaceMetricsApiLambda(stack, "Nyc311WorkspaceMetricsApiLambda", {
    envName,
    liveWorkspaceMetricsTable,
  });
  const usersTable = new UsersTable(stack, "UsersTable", { envName });
  const adminAuth = new Nyc311AdminAuth(stack, "Nyc311AdminAuth", { envName });
  const operatorsTable = new OperatorsTable(stack, "OperatorsTable", { envName });
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
  const getFleetLocationsApiLambda = new Nyc311GetFleetLocationsApiLambda(stack, "Nyc311GetFleetLocationsApiLambda", {
    envName,
    operatorsTable,
    ordersTable,
    locationsTable,
  });
  const adHocQueryWorkgroup = new Nyc311AdHocQueryWorkgroup(stack, "Nyc311AdHocQueryWorkgroup", {
    envName,
    warehouseBucket,
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
  const adminApiLambda = new Nyc311AdminApiLambda(stack, "Nyc311AdminApiLambda", {
    envName,
    usersTable,
    operatorsTable,
    ordersTable,
    requestsTable,
    locationsTable,
    featureFlagsTable,
    jobRunsTable: warehouseJobRunsTable,
    warehouseBucket,
    warehouseCatalog,
    adHocQueryWorkgroup,
    jobRunnerLambda: warehouseJobRunnerLambda,
    jobScheduleGroup: warehouseJobScheduleGroup,
    orderExecutionStateMachine,
  });
  const featureFlagApiLambdas = Object.fromEntries(
    FEATURE_FLAG_API_OPERATIONS.map((operation) => [
      operation,
      new Nyc311FeatureFlagApiLambda(stack, `Nyc311FeatureFlagApiLambda${operation}`, {
        envName,
        operation,
        featureFlagsTable,
        usersTable,
      }),
    ])
  ) as Record<FeatureFlagApiOperation, Nyc311FeatureFlagApiLambda>;
  const registerWebhookSubscriptionApiLambda = new Nyc311RegisterWebhookSubscriptionApiLambda(
    stack,
    "Nyc311RegisterWebhookSubscriptionApiLambda",
    { envName, webhookSubscriptionsTable: new WebhookSubscriptionsTable(stack, "WebhookSubscriptionsTable", { envName }) }
  );
  /* The sink is Test-only, exactly as Nyc311Stack wires it. */
  const webhookSinkDeliveriesTable = envName === "TEST" ? new WebhookSinkDeliveriesTable(stack, "WebhookSinkDeliveriesTable", { envName }) : undefined;
  const webhookSinkApiLambdas = webhookSinkDeliveriesTable && {
    RECEIVE: new Nyc311WebhookSinkOperationApiLambda(stack, "Nyc311ReceiveWebhookSinkApiLambda", { envName, operation: "RECEIVE", webhookSinkDeliveriesTable }),
    LIST: new Nyc311WebhookSinkOperationApiLambda(stack, "Nyc311GetWebhookSinkDeliveriesApiLambda", { envName, operation: "LIST", webhookSinkDeliveriesTable }),
  };
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
    workspaceMetricsApiLambda,
    getFleetLocationsApiLambda,
    adminApiLambda,
    featureFlagApiLambdas,
    registerWebhookSubscriptionApiLambda,
    webhookSinkApiLambdas,
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
    testTemplate.resourceCountIs("AWS::ApiGatewayV2::Integration", 14);
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

  it("wires the three GET /data/* warehouse routes and GET /workspace/metrics", () => {
    for (const routeKey of ["GET /data/schema", "GET /data/jobs", "GET /data/jobs/{name}/result", "GET /workspace/metrics"]) {
      testTemplate.hasResourceProperties("AWS::ApiGatewayV2::Route", { RouteKey: routeKey });
    }
  });

  it("wires every ADMIN_API_ROUTES key behind the JWT authorizer, all on one integration to the admin bundle", () => {
    const routes = Object.values(testTemplate.findResources("AWS::ApiGatewayV2::Route")).filter((route) =>
      (ADMIN_API_ROUTES as readonly string[]).includes(route.Properties.RouteKey)
    );
    expect(routes.map((route) => route.Properties.RouteKey).sort()).toEqual([...ADMIN_API_ROUTES].sort());
    expect(routes.every((route) => route.Properties.AuthorizationType === "JWT")).toBe(true);
    expect(new Set(routes.map((route) => JSON.stringify(route.Properties.Target))).size).toBe(1);

    const [integrationId] = Object.keys(testTemplate.findResources("AWS::ApiGatewayV2::Integration")).filter((id) => id.includes("AdminApiIntegration"));
    expect(routes[0].Properties.Target).toEqual({ "Fn::Join": ["", ["integrations/", { Ref: integrationId }]] });
    testTemplate.hasResourceProperties("AWS::ApiGatewayV2::Integration", {
      IntegrationUri: { "Fn::GetAtt": [Match.stringLikeRegexp("^Nyc311AdminApiLambda"), "Arn"] },
    });
  });

  it("grants API Gateway one API-scoped invoke permission on the admin bundle, not one per route", () => {
    const permissions = Object.values(testTemplate.findResources("AWS::Lambda::Permission")).filter((permission) =>
      JSON.stringify(permission.Properties.FunctionName).includes("Nyc311AdminApiLambda")
    );
    expect(permissions).toHaveLength(1);
    expect(JSON.stringify(permissions[0].Properties.SourceArn)).toMatch(/\/\*\/\*"/);
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
        "PUT /admin/warehouse/jobs/{name}",
        "DELETE /admin/warehouse/jobs/{name}",
        "GET /admin/warehouse/jobs/{name}/sql",
        "POST /admin/warehouse/job-runs/results",
        "POST /admin/feature-flags",
        "PUT /admin/feature-flags/{flag_key}",
        "DELETE /admin/feature-flags/{flag_key}",
      ].sort()
    );
  });

  it("allows POST, PUT, and DELETE in CORS, alongside GET", () => {
    testTemplate.hasResourceProperties("AWS::ApiGatewayV2::Api", {
      CorsConfiguration: Match.objectLike({
        AllowMethods: Match.arrayWith(["GET", "POST", "PUT", "DELETE"]),
      }),
    });
  });

  it("wires the public feature-flag reads and getTreatment with no authorizer", () => {
    for (const routeKey of ["GET /feature-flags", "GET /feature-flags/{flag_key}", "POST /feature-flags/{flag_key}/treatment"]) {
      testTemplate.hasResourceProperties("AWS::ApiGatewayV2::Route", { RouteKey: routeKey, AuthorizationType: "NONE" });
    }
  });

  it("declares exactly twenty-eight routes in Test today, and twenty-six in Prod (no webhook sink)", () => {
    testTemplate.resourceCountIs("AWS::ApiGatewayV2::Route", 28);
    prodTemplate.resourceCountIs("AWS::ApiGatewayV2::Route", 26);
  });

  it("wires POST /webhook-subscriptions with no authorizer in both environments — the Lambda checks the key", () => {
    for (const template of [testTemplate, prodTemplate]) {
      template.hasResourceProperties("AWS::ApiGatewayV2::Route", { RouteKey: "POST /webhook-subscriptions", AuthorizationType: "NONE" });
    }
  });

  it("wires the webhook sink's two public routes in Test only", () => {
    for (const routeKey of ["POST /webhook-sink", "GET /webhook-sink/deliveries"]) {
      testTemplate.hasResourceProperties("AWS::ApiGatewayV2::Route", { RouteKey: routeKey, AuthorizationType: "NONE" });
      prodTemplate.resourcePropertiesCountIs("AWS::ApiGatewayV2::Route", { RouteKey: routeKey }, 0);
    }
  });

  it("throttles the $default stage, tighter on /fleet/locations, /lambda-metrics and webhook registration (v1-prod-deployment.md B3)", () => {
    prodTemplate.hasResourceProperties("AWS::ApiGatewayV2::Stage", {
      StageName: "$default",
      DefaultRouteSettings: { ThrottlingRateLimit: 10, ThrottlingBurstLimit: 20 },
      RouteSettings: {
        "GET /fleet/locations": { ThrottlingRateLimit: 2, ThrottlingBurstLimit: 5 },
        "GET /lambda-metrics": { ThrottlingRateLimit: 1, ThrottlingBurstLimit: 2 },
        "POST /webhook-subscriptions": { ThrottlingRateLimit: 1, ThrottlingBurstLimit: 5 },
      },
    });
  });

  it("makes the stage depend on every throttled route, so routeSettings never names a missing route", () => {
    const [stage] = Object.values(prodTemplate.findResources("AWS::ApiGatewayV2::Stage"));
    const routes = prodTemplate.findResources("AWS::ApiGatewayV2::Route");
    const throttledRouteIds = Object.entries(routes)
      .filter(([, route]) => Object.keys(ROUTE_THROTTLES).includes(route.Properties.RouteKey))
      .map(([id]) => id);
    expect(throttledRouteIds).toHaveLength(3);
    expect(stage.DependsOn).toEqual(expect.arrayContaining(throttledRouteIds));
  });
});
