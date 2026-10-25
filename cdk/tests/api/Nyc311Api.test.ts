import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import { beforeAll, describe, expect, it } from "vitest";
import { RequestsTable } from "../../data/RequestsTable";
import { LocationsTable } from "../../data/LocationsTable";
import { OrdersTable } from "../../data/OrdersTable";
import { WarehouseJobRunsTable } from "../../data/WarehouseJobRunsTable";
import { Nyc311WarehouseBucket } from "../../warehouse/Nyc311WarehouseBucket";
import { Nyc311WarehouseCatalog } from "../../warehouse/Nyc311WarehouseCatalog";
import { Nyc311DataApiLambda } from "../../warehouse/Nyc311DataApiLambda";
import { Nyc311AdHocQueryWorkgroup } from "../../warehouse/Nyc311AdHocQueryWorkgroup";
import { Nyc311AnalyticsWorkgroup } from "../../warehouse/Nyc311AnalyticsWorkgroup";
import { Nyc311WarehouseJobRunnerLambda } from "../../warehouse/Nyc311WarehouseJobRunnerLambda";
import { Nyc311WarehouseJobScheduleGroup } from "../../warehouse/Nyc311WarehouseJobScheduleGroup";
import { UsersTable } from "../../data/UsersTable";
import { Nyc311AdminAuth } from "../../auth/Nyc311AdminAuth";
import { OperatorsTable } from "../../data/OperatorsTable";
import { Nyc311AdminApiLambda } from "../../lambda/Nyc311AdminApiLambda";
import { Nyc311FleetApiLambda } from "../../lambda/Nyc311FleetApiLambda";
import { Nyc311FeatureFlagsApiLambda } from "../../lambda/Nyc311FeatureFlagsApiLambda";
import { Nyc311MonitoringApiLambda } from "../../lambda/Nyc311MonitoringApiLambda";
import { FeatureFlagsTable } from "../../data/FeatureFlagsTable";
import { LiveWorkspaceMetricsTable } from "../../data/LiveWorkspaceMetricsTable";
import { WebhookSubscriptionsTable } from "../../data/WebhookSubscriptionsTable";
import { WebhookSinkDeliveriesTable } from "../../data/WebhookSinkDeliveriesTable";
import { Nyc311WebhookSubscriptionsApiLambda } from "../../lambda/Nyc311WebhookSubscriptionsApiLambda";
import { Nyc311WebhookSinkApiLambda } from "../../lambda/Nyc311WebhookSinkApiLambda";
import { Nyc311Api, ROUTE_THROTTLES } from "../../api/Nyc311Api";
import { ADMIN_API_ROUTES } from "../../../backend/controller/web-api/admin/adminApiRoutes";
import { DATA_API_ROUTES } from "../../../backend/controller/web-api/data/dataApiRoutes";
import { FEATURE_FLAGS_API_ROUTES } from "../../../backend/controller/web-api/featureFlags/featureFlagsApiRoutes";
import { FLEET_API_ROUTES } from "../../../backend/controller/web-api/fleet/fleetApiRoutes";
import { MONITORING_API_ROUTES } from "../../../backend/controller/web-api/monitoring/monitoringApiRoutes";
import { WEBHOOK_SINK_API_ROUTES } from "../../../backend/controller/web-api/webhookSink/webhookSinkApiRoutes";
import { WEBHOOK_SUBSCRIPTIONS_API_ROUTES } from "../../../backend/controller/web-api/webhookSubscriptions/webhookSubscriptionsApiRoutes";

const SITE_DOMAIN = "test.boroughsim.com";
const CLOUDFRONT_DOMAIN = "d123456abcdef.cloudfront.net";

const MONITORED = {
  pollerFunctionName: "Nyc311Poller-Test",
  orderFanOutFunctionName: "Nyc311RequestsFanOut-Test",
  locationsFanOutFunctionName: "Nyc311LocationsFanOut-Test",
  operatorsFanOutFunctionName: "Nyc311OperatorsStreamFanOut-Test",
  requestEvaluationFunctionName: "Nyc311RequestEvaluation-Test",
  orderEventFanOutFunctionName: "Nyc311OrdersStreamFanOut-Test",
  orderEvaluationFunctionName: "Nyc311OrderEvaluation-Test",
  orderSchedulingFunctionName: "Nyc311OrderScheduling-Test",
  warehouseJobRunnerFunctionName: "Nyc311WarehouseJobRunner-Test",
  adminApiFunctionName: "Nyc311AdminApi-Test",
  featureFlagsApiFunctionName: "Nyc311FeatureFlagsApi-Test",
  dataApiFunctionName: "Nyc311DataApi-Test",
  fleetApiFunctionName: "Nyc311GetFleetLocationsApi-Test",
  webhookSubscriptionsApiFunctionName: "Nyc311RegisterWebhookSubscriptionApi-Test",
};

/* Each bundle's construct-ID prefix and route list, as Nyc311Stack wires them. */
const BUNDLES: { lambdaId: string; routes: readonly string[]; testOnly?: boolean }[] = [
  { lambdaId: "Nyc311AdminApiLambda", routes: ADMIN_API_ROUTES },
  { lambdaId: "Nyc311FeatureFlagsApiLambda", routes: FEATURE_FLAGS_API_ROUTES },
  { lambdaId: "Nyc311DataApiLambda", routes: DATA_API_ROUTES },
  { lambdaId: "Nyc311MonitoringApiLambda", routes: MONITORING_API_ROUTES },
  { lambdaId: "Nyc311GetFleetLocationsApiLambda", routes: FLEET_API_ROUTES },
  { lambdaId: "Nyc311RegisterWebhookSubscriptionApiLambda", routes: WEBHOOK_SUBSCRIPTIONS_API_ROUTES },
  { lambdaId: "Nyc311WebhookSinkApiLambda", routes: WEBHOOK_SINK_API_ROUTES, testOnly: true },
];

function synthesize(envName: "TEST" | "PROD"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  const requestsTable = new RequestsTable(stack, "RequestsTable", { envName });
  const ordersTable = new OrdersTable(stack, "OrdersTable", { envName });
  const warehouseJobRunsTable = new WarehouseJobRunsTable(stack, "WarehouseJobRunsTable", { envName });
  const warehouseBucket = new Nyc311WarehouseBucket(stack, "Nyc311WarehouseBucket", { envName });
  const warehouseCatalog = new Nyc311WarehouseCatalog(stack, "Nyc311WarehouseCatalog", { envName, warehouseBucket });
  const featureFlagsTable = new FeatureFlagsTable(stack, "FeatureFlagsTable", { envName });
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
  const getFleetLocationsApiLambda = new Nyc311FleetApiLambda(stack, "Nyc311GetFleetLocationsApiLambda", {
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
  const apiDomainName = apigwv2.DomainName.fromDomainNameAttributes(stack, "ApiDomainName", {
    name: "api.test.boroughsim.com",
    regionalDomainName: "d-abc123.execute-api.us-east-1.amazonaws.com",
    regionalHostedZoneId: "Z1UJRXOUMOOFR7",
  });
  new Nyc311Api(stack, "Nyc311Api", {
    envName,
    adminApiLambda,
    featureFlagsApiLambda: new Nyc311FeatureFlagsApiLambda(stack, "Nyc311FeatureFlagsApiLambda", { envName, featureFlagsTable }),
    dataApiLambda: new Nyc311DataApiLambda(stack, "Nyc311DataApiLambda", {
      envName,
      warehouseCatalog,
      liveWorkspaceMetricsTable: new LiveWorkspaceMetricsTable(stack, "LiveWorkspaceMetricsTable", { envName }),
    }),
    monitoringApiLambda: new Nyc311MonitoringApiLambda(stack, "Nyc311MonitoringApiLambda", { envName, ...MONITORED, requestsTable }),
    fleetApiLambda: getFleetLocationsApiLambda,
    webhookSubscriptionsApiLambda: new Nyc311WebhookSubscriptionsApiLambda(stack, "Nyc311RegisterWebhookSubscriptionApiLambda", {
      envName,
      webhookSubscriptionsTable: new WebhookSubscriptionsTable(stack, "WebhookSubscriptionsTable", { envName }),
    }),
    /* The sink is Test-only, exactly as Nyc311Stack wires it. */
    webhookSinkApiLambda:
      envName === "TEST"
        ? new Nyc311WebhookSinkApiLambda(stack, "Nyc311WebhookSinkApiLambda", {
            envName,
            webhookSinkDeliveriesTable: new WebhookSinkDeliveriesTable(stack, "WebhookSinkDeliveriesTable", { envName }),
          })
        : undefined,
    adminAuthorizer: adminAuth.authorizer,
    webAppDomainNames: [SITE_DOMAIN, CLOUDFRONT_DOMAIN],
    apiDomainName,
  });
  return Template.fromStack(stack);
}

type Resource = { Properties: Record<string, unknown> };

function routesOf(template: Template): Resource[] {
  return Object.values(template.findResources("AWS::ApiGatewayV2::Route")) as Resource[];
}

/* The logical ID of the integration whose URI is this Lambda's ARN. */
function integrationIdFor(template: Template, lambdaId: string): string {
  const ids = Object.entries(template.findResources("AWS::ApiGatewayV2::Integration"))
    .filter(([, integration]) => JSON.stringify(integration.Properties.IntegrationUri).includes(`"${lambdaId}`))
    .map(([id]) => id);
  expect(ids).toHaveLength(1);
  return ids[0];
}

describe("Nyc311Api", () => {
  /* One synth per environment, cached — synthesizing per `it()` once dominated this file's CI shard. */
  let testTemplate: Template;
  let prodTemplate: Template;

  beforeAll(() => {
    testTemplate = synthesize("TEST");
    prodTemplate = synthesize("PROD");
  });

  it("is an HTTP API (apigatewayv2), not a REST API, suffixed by environment", () => {
    testTemplate.hasResourceProperties("AWS::ApiGatewayV2::Api", { Name: "Nyc311Api-Test", ProtocolType: "HTTP" });
    prodTemplate.hasResourceProperties("AWS::ApiGatewayV2::Api", { Name: "Nyc311Api-Prod", ProtocolType: "HTTP" });
  });

  it("allows CORS from the custom site domain, the CloudFront default, and local dev", () => {
    testTemplate.hasResourceProperties("AWS::ApiGatewayV2::Api", {
      CorsConfiguration: Match.objectLike({
        AllowOrigins: [`https://${SITE_DOMAIN}`, `https://${CLOUDFRONT_DOMAIN}`, "http://localhost:5173"],
      }),
    });
  });

  it("allows POST, PUT, and DELETE in CORS, alongside GET", () => {
    testTemplate.hasResourceProperties("AWS::ApiGatewayV2::Api", {
      CorsConfiguration: Match.objectLike({ AllowMethods: Match.arrayWith(["GET", "POST", "PUT", "DELETE"]) }),
    });
  });

  it("maps the API's custom domain as the default domain", () => {
    testTemplate.hasResourceProperties("AWS::ApiGatewayV2::ApiMapping", { DomainName: "api.test.boroughsim.com" });
  });

  it.each(BUNDLES.map((bundle) => [bundle.lambdaId, bundle] as const))(
    "routes every key in %s's route list to that bundle's one integration",
    (_lambdaId, bundle) => {
      const integrationId = integrationIdFor(testTemplate, bundle.lambdaId);
      const routes = routesOf(testTemplate).filter((route) => bundle.routes.includes(route.Properties.RouteKey as string));

      expect(routes.map((route) => route.Properties.RouteKey).sort()).toEqual([...bundle.routes].sort());
      for (const route of routes) {
        expect(route.Properties.Target).toEqual({ "Fn::Join": ["", ["integrations/", { Ref: integrationId }]] });
      }
    }
  );

  it("grants API Gateway one API-scoped invoke permission per bundle, not one per route", () => {
    for (const bundle of BUNDLES) {
      const permissions = Object.values(testTemplate.findResources("AWS::Lambda::Permission")).filter((permission) =>
        JSON.stringify(permission.Properties.FunctionName).includes(`"${bundle.lambdaId}`)
      );
      expect(permissions).toHaveLength(1);
      expect(JSON.stringify(permissions[0].Properties.SourceArn)).toMatch(/\/\*\/\*"/);
    }
  });

  it("attaches the JWT authorizer to exactly the admin bundle's routes", () => {
    const authorized = routesOf(testTemplate)
      .filter((route) => route.Properties.AuthorizationType === "JWT")
      .map((route) => route.Properties.RouteKey)
      .sort();
    expect(authorized).toEqual([...ADMIN_API_ROUTES].sort());
    expect(authorized).toContain("GET /admin/warehouse/job-runs");
  });

  it("no longer serves the retired public /data/jobs routes", () => {
    for (const routeKey of ["GET /data/jobs", "GET /data/jobs/{name}/result"]) {
      testTemplate.resourcePropertiesCountIs("AWS::ApiGatewayV2::Route", { RouteKey: routeKey }, 0);
    }
  });

  it("declares exactly the bundles' routes, on one integration per bundle (no sink in Prod)", () => {
    const routeCount = (testOnly: boolean): number =>
      BUNDLES.filter((bundle) => testOnly || !bundle.testOnly).reduce((n, bundle) => n + bundle.routes.length, 0);

    testTemplate.resourceCountIs("AWS::ApiGatewayV2::Route", routeCount(true));
    prodTemplate.resourceCountIs("AWS::ApiGatewayV2::Route", routeCount(false));
    testTemplate.resourceCountIs("AWS::ApiGatewayV2::Integration", BUNDLES.length);
    prodTemplate.resourceCountIs("AWS::ApiGatewayV2::Integration", BUNDLES.length - 1);
    testTemplate.resourceCountIs("AWS::Lambda::Permission", BUNDLES.length);
    testTemplate.hasResourceProperties("AWS::ApiGatewayV2::Integration", { IntegrationType: "AWS_PROXY", PayloadFormatVersion: "2.0" });
  });

  it("wires the webhook sink's two public routes in Test only", () => {
    for (const routeKey of WEBHOOK_SINK_API_ROUTES) {
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
    const throttledRouteIds = Object.entries(prodTemplate.findResources("AWS::ApiGatewayV2::Route"))
      .filter(([, route]) => Object.keys(ROUTE_THROTTLES).includes(route.Properties.RouteKey))
      .map(([id]) => id);
    expect(throttledRouteIds).toHaveLength(3);
    expect(stage.DependsOn).toEqual(expect.arrayContaining(throttledRouteIds));
  });
});
