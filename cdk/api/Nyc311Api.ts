import { Duration } from "aws-cdk-lib";
import { CorsHttpMethod, HttpApi, HttpMethod, type IDomainName } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import type { HttpUserPoolAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import type { Construct } from "constructs";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";
import type { Nyc311MetricsApiLambda } from "../lambda/Nyc311MetricsApiLambda";
import type { Nyc311OrdersApiLambda } from "../lambda/Nyc311OrdersApiLambda";
import type { Nyc311OrderEventsApiLambda } from "../lambda/Nyc311OrderEventsApiLambda";
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
import type { Nyc311ReportsApiLambda } from "../warehouse/Nyc311ReportsApiLambda";

export interface Nyc311ApiProps {
  envName: Nyc311Environment;
  metricsApiLambda: Nyc311MetricsApiLambda;
  ordersApiLambda: Nyc311OrdersApiLambda;
  orderEventsApiLambda: Nyc311OrderEventsApiLambda;
  lambdaMetricsApiLambda: Nyc311LambdaMetricsApiLambda;
  warehouseSchemaApiLambda: Nyc311WarehouseSchemaApiLambda;
  warehouseJobsApiLambda: Nyc311WarehouseJobsApiLambda;
  jobResultApiLambda: Nyc311JobResultApiLambda;
  reportsApiLambda: Nyc311ReportsApiLambda;
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
        allowMethods: [CorsHttpMethod.GET, CorsHttpMethod.POST, CorsHttpMethod.DELETE],
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

    this.addRoutes({
      path: "/orders",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("GetOrdersIntegration", props.ordersApiLambda),
    });

    this.addRoutes({
      path: "/order-events",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("GetOrderEventsIntegration", props.orderEventsApiLambda),
    });

    this.addRoutes({
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
      path: "/reports",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("GetReportsIntegration", props.reportsApiLambda),
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

    this.addRoutes({
      path: "/fleet/locations",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("GetFleetLocationsIntegration", props.getFleetLocationsApiLambda),
    });
  }
}
