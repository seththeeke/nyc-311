import { Duration } from "aws-cdk-lib";
import { CfnStage, CorsHttpMethod, HttpApi, HttpMethod, type IDomainName } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import type { HttpUserPoolAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import type { Construct } from "constructs";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";
import type { Nyc311MetricsApiLambda } from "../lambda/Nyc311MetricsApiLambda";
import type { Nyc311LambdaMetricsApiLambda } from "../lambda/Nyc311LambdaMetricsApiLambda";
import type { Nyc311AdminWhoamiApiLambda } from "../lambda/Nyc311AdminWhoamiApiLambda";
import type { Nyc311AddCapacityApiLambda } from "../lambda/Nyc311AddCapacityApiLambda";
import type { Nyc311RemoveCapacityApiLambda } from "../lambda/Nyc311RemoveCapacityApiLambda";
import type { Nyc311GetCapacityApiLambda } from "../lambda/Nyc311GetCapacityApiLambda";
import type { Nyc311RunSchedulingApiLambda } from "../lambda/Nyc311RunSchedulingApiLambda";
import type { Nyc311GetFleetLocationsApiLambda } from "../lambda/Nyc311GetFleetLocationsApiLambda";
import type { Nyc311WarehouseSchemaApiLambda } from "../warehouse/Nyc311WarehouseSchemaApiLambda";
import type { Nyc311WarehouseJobsApiLambda } from "../warehouse/Nyc311WarehouseJobsApiLambda";
import type { Nyc311JobResultApiLambda } from "../warehouse/Nyc311JobResultApiLambda";
import type { Nyc311WorkspaceMetricsApiLambda } from "../warehouse/Nyc311WorkspaceMetricsApiLambda";
import type { Nyc311AdHocQueryApiLambda } from "../warehouse/Nyc311AdHocQueryApiLambda";
import type { Nyc311CreateWarehouseJobApiLambda } from "../warehouse/Nyc311CreateWarehouseJobApiLambda";
import type { Nyc311UpdateWarehouseJobApiLambda } from "../warehouse/Nyc311UpdateWarehouseJobApiLambda";
import type { Nyc311DeleteWarehouseJobApiLambda } from "../warehouse/Nyc311DeleteWarehouseJobApiLambda";
import type { Nyc311ListWarehouseJobsApiLambda } from "../warehouse/Nyc311ListWarehouseJobsApiLambda";
import type { Nyc311GetWarehouseJobSqlApiLambda } from "../warehouse/Nyc311GetWarehouseJobSqlApiLambda";
import type { Nyc311GetWarehouseJobRunResultsApiLambda } from "../warehouse/Nyc311GetWarehouseJobRunResultsApiLambda";
import type { FeatureFlagApiOperation, Nyc311FeatureFlagApiLambda } from "../lambda/Nyc311FeatureFlagApiLambda";
import type { Nyc311RegisterWebhookSubscriptionApiLambda } from "../lambda/Nyc311RegisterWebhookSubscriptionApiLambda";
import type { Nyc311WebhookSinkApiLambda, WebhookSinkApiOperation } from "../lambda/Nyc311WebhookSinkApiLambda";

export interface Nyc311ApiProps {
  envName: Nyc311Environment;
  metricsApiLambda: Nyc311MetricsApiLambda;
  lambdaMetricsApiLambda: Nyc311LambdaMetricsApiLambda;
  warehouseSchemaApiLambda: Nyc311WarehouseSchemaApiLambda;
  warehouseJobsApiLambda: Nyc311WarehouseJobsApiLambda;
  jobResultApiLambda: Nyc311JobResultApiLambda;
  /** The secondary workspace's metric tiles — public, read-only. */
  workspaceMetricsApiLambda: Nyc311WorkspaceMetricsApiLambda;
  /** `9-admin-auth-integration.md` §8 — the first route behind the admin JWT authorizer. */
  adminWhoamiApiLambda: Nyc311AdminWhoamiApiLambda;
  /** `10-capacity-modeling-and-integration.md` §2.1 — admin-only capacity CRUD, same authorizer. */
  addCapacityApiLambda: Nyc311AddCapacityApiLambda;
  removeCapacityApiLambda: Nyc311RemoveCapacityApiLambda;
  getCapacityApiLambda: Nyc311GetCapacityApiLambda;
  /** `10-capacity-modeling-and-integration.md` §5.1 — the admin on-demand scheduling trigger, same authorizer. */
  runSchedulingApiLambda: Nyc311RunSchedulingApiLambda;
  /** `10-capacity-modeling-and-integration.md` §6.1 — the public home-page map's data source, no authorizer. */
  getFleetLocationsApiLambda: Nyc311GetFleetLocationsApiLambda;
  /** `7-data-warehousing.md` §12a (Leg 7) — the admin ad-hoc SQL console, same authorizer. */
  adHocQueryApiLambda: Nyc311AdHocQueryApiLambda;
  /** `7-data-warehousing.md` §12b (Leg 8) — self-service job authoring, same authorizer. */
  createWarehouseJobApiLambda: Nyc311CreateWarehouseJobApiLambda;
  updateWarehouseJobApiLambda: Nyc311UpdateWarehouseJobApiLambda;
  deleteWarehouseJobApiLambda: Nyc311DeleteWarehouseJobApiLambda;
  listWarehouseJobsApiLambda: Nyc311ListWarehouseJobsApiLambda;
  getWarehouseJobSqlApiLambda: Nyc311GetWarehouseJobSqlApiLambda;
  /** `7-data-warehousing.md` §12b's Reports tab addition — bulk raw job-run results by id, same authorizer. */
  getWarehouseJobRunResultsApiLambda: Nyc311GetWarehouseJobRunResultsApiLambda;
  /** `11-street-condition-implementation.md` §4.2 — one Lambda per feature-flag operation. */
  featureFlagApiLambdas: Record<FeatureFlagApiOperation, Nyc311FeatureFlagApiLambda>;
  /** `13-customer-simulation.md` §5 — no authorizer; the Lambda checks the registration key itself. */
  registerWebhookSubscriptionApiLambda: Nyc311RegisterWebhookSubscriptionApiLambda;
  /** The Test-only webhook sink's two routes — omitted in Prod, which then has neither route. */
  webhookSinkApiLambdas?: Record<WebhookSinkApiOperation, Nyc311WebhookSinkApiLambda>;
  /** `Nyc311AdminAuth`'s authorizer — attached only to admin-only routes, never as the API's default. */
  adminAuthorizer: HttpUserPoolAuthorizer;
  /**
   * Every web origin the SPA is served from — the custom site domain
   * (`8-domain-name-assignment.md` §1) and WebsiteHosting's CloudFront
   * default `*.cloudfront.net` name. All are allowed by CORS alongside
   * local dev; issue #4 keeps the default name on the list for now.
   */
  webAppDomainNames: string[];
  /** This environment's API custom domain (`Nyc311ApiDomain`) — mapped as the default domain. */
  apiDomainName: IDomainName;
}

/*
 * The web-app's Vite dev server default port (web-app/vite.config.ts) —
 * allowed by CORS so the "live" data mode can be exercised against a
 * deployed Test API without a browser-side CORS error during local dev.
 */
const LOCAL_DEV_ORIGIN = "http://localhost:5173";

/*
 * v1-prod-deployment.md B3/Q9 — crude, free abuse protection: a stage-wide
 * default plus tighter limits on the two expensive public routes. Sized
 * against the web-app's polling (/fleet/locations every 15s, /lambda-metrics
 * every 60s per viewer): ~30 and ~60 concurrent viewers respectively.
 * Per stage/route, not per client IP — one abuser can 429 everyone, which
 * is accepted over WAF's cost.
 */
export const DEFAULT_THROTTLE = { rateLimit: 10, burstLimit: 20 };
export const ROUTE_THROTTLES: Record<string, { rateLimit: number; burstLimit: number }> = {
  "GET /fleet/locations": { rateLimit: 2, burstLimit: 5 },
  "GET /lambda-metrics": { rateLimit: 1, burstLimit: 2 },
  /* Called once per subscriber deploy (13-customer-simulation.md §5), so far below the stage default. */
  "POST /webhook-subscriptions": { rateLimit: 1, burstLimit: 5 },
};

/* Feature-flag routes (§4.2): reads and getTreatment are public, every write is admin-only. */
const FEATURE_FLAG_ROUTES: { operation: FeatureFlagApiOperation; path: string; method: HttpMethod; admin: boolean }[] = [
  { operation: "LIST", path: "/feature-flags", method: HttpMethod.GET, admin: false },
  { operation: "GET", path: "/feature-flags/{flag_key}", method: HttpMethod.GET, admin: false },
  { operation: "GET_TREATMENT", path: "/feature-flags/{flag_key}/treatment", method: HttpMethod.POST, admin: false },
  { operation: "CREATE", path: "/admin/feature-flags", method: HttpMethod.POST, admin: true },
  { operation: "UPDATE", path: "/admin/feature-flags/{flag_key}", method: HttpMethod.PUT, admin: true },
  { operation: "DELETE", path: "/admin/feature-flags/{flag_key}", method: HttpMethod.DELETE, admin: true },
];

/**
 * The public web API Gateway (`claude-prompt-initial.md` §5/§7) — an HTTP
 * API, cheaper than REST. Serves both its custom domain and `execute-api`.
 *
 * `/admin/whoami` and `/capacity` are admin-authorized
 * (`9-admin-auth-integration.md` §4/§8,
 * `10-capacity-modeling-and-integration.md` §2.1) — the JWT authorizer
 * attaches per-route, never as the API's default, so every other route
 * stays public/unauthenticated.
 */
export class Nyc311Api extends HttpApi {
  constructor(scope: Construct, id: string, props: Nyc311ApiProps) {
    const suffix = ENV_NAME_SUFFIX[props.envName];

    super(scope, id, {
      apiName: `Nyc311Api-${suffix}`,
      corsPreflight: {
        allowOrigins: [...props.webAppDomainNames.map((d) => `https://${d}`), LOCAL_DEV_ORIGIN],
        allowMethods: [CorsHttpMethod.GET, CorsHttpMethod.POST, CorsHttpMethod.PUT, CorsHttpMethod.DELETE],
        allowHeaders: ["Content-Type", "Authorization"],
        maxAge: Duration.days(1),
      },
      defaultDomainMapping: { domainName: props.apiDomainName },
    });

    this.addRoutes({
      path: "/ingestion/metrics",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("GetPollerMetricsIntegration", props.metricsApiLambda),
    });

    const lambdaMetricsRoutes = this.addRoutes({
      path: "/lambda-metrics",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("GetLambdaMetricsIntegration", props.lambdaMetricsApiLambda),
    });

    this.addRoutes({
      path: "/data/schema",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("GetWarehouseSchemaIntegration", props.warehouseSchemaApiLambda),
    });

    this.addRoutes({
      path: "/data/jobs",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("GetWarehouseJobsIntegration", props.warehouseJobsApiLambda),
    });

    this.addRoutes({
      path: "/data/jobs/{name}/result",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("GetJobResultIntegration", props.jobResultApiLambda),
    });

    this.addRoutes({
      path: "/workspace/metrics",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("GetWorkspaceMetricsIntegration", props.workspaceMetricsApiLambda),
    });

    this.addRoutes({
      path: "/admin/whoami",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("GetAdminWhoamiIntegration", props.adminWhoamiApiLambda),
      authorizer: props.adminAuthorizer,
    });

    this.addRoutes({
      path: "/capacity",
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration("AddCapacityIntegration", props.addCapacityApiLambda),
      authorizer: props.adminAuthorizer,
    });

    this.addRoutes({
      path: "/capacity/{operator_id}",
      methods: [HttpMethod.DELETE],
      integration: new HttpLambdaIntegration("RemoveCapacityIntegration", props.removeCapacityApiLambda),
      authorizer: props.adminAuthorizer,
    });

    this.addRoutes({
      path: "/capacity",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("GetCapacityIntegration", props.getCapacityApiLambda),
      authorizer: props.adminAuthorizer,
    });

    this.addRoutes({
      path: "/scheduling/run",
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration("RunSchedulingIntegration", props.runSchedulingApiLambda),
      authorizer: props.adminAuthorizer,
    });

    const fleetLocationsRoutes = this.addRoutes({
      path: "/fleet/locations",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("GetFleetLocationsIntegration", props.getFleetLocationsApiLambda),
    });

    this.addRoutes({
      path: "/admin/warehouse/query",
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration("RunAdHocQueryIntegration", props.adHocQueryApiLambda),
      authorizer: props.adminAuthorizer,
    });

    this.addRoutes({
      path: "/admin/warehouse/jobs",
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration("CreateWarehouseJobIntegration", props.createWarehouseJobApiLambda),
      authorizer: props.adminAuthorizer,
    });

    this.addRoutes({
      path: "/admin/warehouse/jobs/{name}",
      methods: [HttpMethod.DELETE],
      integration: new HttpLambdaIntegration("DeleteWarehouseJobIntegration", props.deleteWarehouseJobApiLambda),
      authorizer: props.adminAuthorizer,
    });

    this.addRoutes({
      path: "/admin/warehouse/jobs/{name}",
      methods: [HttpMethod.PUT],
      integration: new HttpLambdaIntegration("UpdateWarehouseJobIntegration", props.updateWarehouseJobApiLambda),
      authorizer: props.adminAuthorizer,
    });

    this.addRoutes({
      path: "/admin/warehouse/jobs",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("ListWarehouseJobsIntegration", props.listWarehouseJobsApiLambda),
      authorizer: props.adminAuthorizer,
    });

    this.addRoutes({
      path: "/admin/warehouse/jobs/{name}/sql",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("GetWarehouseJobSqlIntegration", props.getWarehouseJobSqlApiLambda),
      authorizer: props.adminAuthorizer,
    });

    this.addRoutes({
      path: "/admin/warehouse/job-runs/results",
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration("PostJobRunResultsIntegration", props.getWarehouseJobRunResultsApiLambda),
      authorizer: props.adminAuthorizer,
    });

    for (const route of FEATURE_FLAG_ROUTES) {
      this.addRoutes({
        path: route.path,
        methods: [route.method],
        integration: new HttpLambdaIntegration(`FeatureFlag${route.operation}Integration`, props.featureFlagApiLambdas[route.operation]),
        ...(route.admin ? { authorizer: props.adminAuthorizer } : {}),
      });
    }

    const registerWebhookSubscriptionRoutes = this.addRoutes({
      path: "/webhook-subscriptions",
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration("RegisterWebhookSubscriptionIntegration", props.registerWebhookSubscriptionApiLambda),
    });

    if (props.webhookSinkApiLambdas) {
      this.addRoutes({
        path: "/webhook-sink",
        methods: [HttpMethod.POST],
        integration: new HttpLambdaIntegration("ReceiveWebhookSinkIntegration", props.webhookSinkApiLambdas.RECEIVE),
      });
      this.addRoutes({
        path: "/webhook-sink/deliveries",
        methods: [HttpMethod.GET],
        integration: new HttpLambdaIntegration("GetWebhookSinkDeliveriesIntegration", props.webhookSinkApiLambdas.LIST),
      });
    }

    /*
     * The L2 HttpApi exposes no throttle for its auto-created $default
     * stage, so set it on the L1. routeSettings keys must name routes that
     * already exist, hence the explicit dependency on them.
     */
    const cfnStage = this.defaultStage?.node.defaultChild as CfnStage;
    cfnStage.defaultRouteSettings = {
      throttlingRateLimit: DEFAULT_THROTTLE.rateLimit,
      throttlingBurstLimit: DEFAULT_THROTTLE.burstLimit,
    };
    /* routeSettings is untyped JSON on the L1, so CDK won't PascalCase it — use CloudFormation's key names directly. */
    cfnStage.routeSettings = Object.fromEntries(
      Object.entries(ROUTE_THROTTLES).map(([routeKey, limits]) => [
        routeKey,
        { ThrottlingRateLimit: limits.rateLimit, ThrottlingBurstLimit: limits.burstLimit },
      ])
    );
    for (const route of [...fleetLocationsRoutes, ...lambdaMetricsRoutes, ...registerWebhookSubscriptionRoutes]) {
      cfnStage.node.addDependency(route);
    }
  }
}
