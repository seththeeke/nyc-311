import { Duration } from "aws-cdk-lib";
import { CfnStage, CorsHttpMethod, HttpApi, HttpMethod, type HttpRoute, type IDomainName } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import type { HttpUserPoolAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import type { IFunction } from "aws-cdk-lib/aws-lambda";
import type { Construct } from "constructs";
import { ADMIN_API_ROUTES } from "../../backend/controller/web-api/admin/adminApiRoutes";
import { DATA_API_ROUTES } from "../../backend/controller/web-api/data/dataApiRoutes";
import { FEATURE_FLAGS_API_ROUTES } from "../../backend/controller/web-api/featureFlags/featureFlagsApiRoutes";
import { FLEET_API_ROUTES } from "../../backend/controller/web-api/fleet/fleetApiRoutes";
import { MONITORING_API_ROUTES } from "../../backend/controller/web-api/monitoring/monitoringApiRoutes";
import { WEBHOOK_SINK_API_ROUTES } from "../../backend/controller/web-api/webhookSink/webhookSinkApiRoutes";
import { WEBHOOK_SUBSCRIPTIONS_API_ROUTES } from "../../backend/controller/web-api/webhookSubscriptions/webhookSubscriptionsApiRoutes";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";
import type { Nyc311AdminApiLambda } from "../lambda/Nyc311AdminApiLambda";
import type { Nyc311FeatureFlagsApiLambda } from "../lambda/Nyc311FeatureFlagsApiLambda";
import type { Nyc311FleetApiLambda } from "../lambda/Nyc311FleetApiLambda";
import type { Nyc311MonitoringApiLambda } from "../lambda/Nyc311MonitoringApiLambda";
import type { Nyc311WebhookSinkApiLambda } from "../lambda/Nyc311WebhookSinkApiLambda";
import type { Nyc311WebhookSubscriptionsApiLambda } from "../lambda/Nyc311WebhookSubscriptionsApiLambda";
import type { Nyc311DataApiLambda } from "../warehouse/Nyc311DataApiLambda";

export interface Nyc311ApiProps {
  envName: Nyc311Environment;
  /* 15-resource-consolidation.md §3: one Lambda per Service API bundle, each serving every route in its *_API_ROUTES. */
  /** §3.2 — every JWT-authorized route. */
  adminApiLambda: Nyc311AdminApiLambda;
  featureFlagsApiLambda: Nyc311FeatureFlagsApiLambda;
  dataApiLambda: Nyc311DataApiLambda;
  monitoringApiLambda: Nyc311MonitoringApiLambda;
  /** The public home-page map's data source (`10-capacity-modeling-and-integration.md` §6.1). */
  fleetApiLambda: Nyc311FleetApiLambda;
  /** `13-customer-simulation.md` §5 — no authorizer; the Lambda checks the registration key itself. */
  webhookSubscriptionsApiLambda: Nyc311WebhookSubscriptionsApiLambda;
  /** The Test-only webhook sink — omitted in Prod, which then has neither of its routes. */
  webhookSinkApiLambda?: Nyc311WebhookSinkApiLambda;
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

/**
 * The public web API Gateway (`claude-prompt-initial.md` §5/§7) — an HTTP
 * API, cheaper than REST. Serves both its custom domain and `execute-api`.
 *
 * The routes in `ADMIN_API_ROUTES` are admin-authorized
 * (`9-admin-auth-integration.md` §4/§8) — the JWT authorizer attaches
 * per-route, never as the API's default, so every other route stays
 * public/unauthenticated.
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

    const throttledRoutes: HttpRoute[] = [];

    [
      ...this.addBundleRoutes("AdminApi", props.adminApiLambda, ADMIN_API_ROUTES, props.adminAuthorizer),
      ...this.addBundleRoutes("FeatureFlagsApi", props.featureFlagsApiLambda, FEATURE_FLAGS_API_ROUTES),
      ...this.addBundleRoutes("DataApi", props.dataApiLambda, DATA_API_ROUTES),
      ...this.addBundleRoutes("MonitoringApi", props.monitoringApiLambda, MONITORING_API_ROUTES),
      ...this.addBundleRoutes("FleetApi", props.fleetApiLambda, FLEET_API_ROUTES),
      ...this.addBundleRoutes("WebhookSubscriptionsApi", props.webhookSubscriptionsApiLambda, WEBHOOK_SUBSCRIPTIONS_API_ROUTES),
      ...(props.webhookSinkApiLambda ? this.addBundleRoutes("WebhookSinkApi", props.webhookSinkApiLambda, WEBHOOK_SINK_API_ROUTES) : []),
    ].forEach(({ routeKey, routes }) => {
      if (routeKey in ROUTE_THROTTLES) throttledRoutes.push(...routes);
    });

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
    for (const route of throttledRoutes) {
      cfnStage.node.addDependency(route);
    }
  }

  /**
   * One route per key on the bundle's single integration (§4.2/§4.5).
   * `scopePermissionToRoute: false` makes that one API-scoped
   * `Lambda::Permission` instead of one per route; the bundle's router
   * 404s any key it doesn't list.
   */
  private addBundleRoutes(
    bundleName: string,
    handler: IFunction,
    routeKeys: readonly string[],
    authorizer?: HttpUserPoolAuthorizer
  ): { routeKey: string; routes: HttpRoute[] }[] {
    const integration = new HttpLambdaIntegration(`${bundleName}Integration`, handler, { scopePermissionToRoute: false });
    return routeKeys.map((routeKey) => {
      const [method, path] = routeKey.split(" ") as [HttpMethod, string];
      return { routeKey, routes: this.addRoutes({ path, methods: [method], integration, ...(authorizer ? { authorizer } : {}) }) };
    });
  }
}
