import { Duration } from "aws-cdk-lib";
import { CfnStage, CorsHttpMethod, HttpApi, HttpMethod, type HttpRoute, type IDomainName } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import type { Construct } from "constructs";
import { PUBLIC_V1_API_ROUTES } from "../../backend/controller/web-api/publicV1/publicV1ApiRoutes";
import type { Nyc311PublicApiLambda } from "../lambda/Nyc311PublicApiLambda";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311PublicApiProps {
  envName: Nyc311Environment;
  publicApiLambda: Nyc311PublicApiLambda;
  /** `public-api[.test].boroughsim.com` (`Nyc311ApiDomain`), mapped as the default domain. */
  publicApiDomainName: IDomainName;
}

/* 16-resident-action-models.md §2.2 — stage default for every /v1/ route. */
export const PUBLIC_API_DEFAULT_THROTTLE = { rateLimit: 5, burstLimit: 10 };
export const PUBLIC_API_ROUTE_THROTTLES: Record<string, { rateLimit: number; burstLimit: number }> = {
  "POST /v1/feature-requests": { rateLimit: 1, burstLimit: 3 },
};

/**
 * The public API (`16-resident-action-models.md` §2): its own HTTP API, so
 * API Gateway's built-in metrics cover it alone. No authorizer. CORS is
 * open to any origin, since nothing here is authenticated and browsers
 * (the Swagger "Try it") must be able to call it.
 */
export class Nyc311PublicApi extends HttpApi {
  constructor(scope: Construct, id: string, props: Nyc311PublicApiProps) {
    super(scope, id, {
      apiName: `Nyc311PublicApi-${ENV_NAME_SUFFIX[props.envName]}`,
      corsPreflight: {
        allowOrigins: ["*"],
        allowMethods: [CorsHttpMethod.GET, CorsHttpMethod.POST],
        allowHeaders: ["Content-Type", "X-Requester", "Idempotency-Key"],
        exposeHeaders: ["X-Call-Id"],
        maxAge: Duration.days(1),
      },
      defaultDomainMapping: { domainName: props.publicApiDomainName },
    });

    const integration = new HttpLambdaIntegration("PublicV1ApiIntegration", props.publicApiLambda, { scopePermissionToRoute: false });
    const throttledRoutes: HttpRoute[] = [];
    for (const routeKey of PUBLIC_V1_API_ROUTES) {
      const [method, path] = routeKey.split(" ") as [HttpMethod, string];
      const routes = this.addRoutes({ path, methods: [method], integration });
      if (routeKey in PUBLIC_API_ROUTE_THROTTLES) throttledRoutes.push(...routes);
    }

    /* As in Nyc311Api: the L2 exposes no stage throttle, and routeSettings keys must name routes that already exist. */
    const cfnStage = this.defaultStage?.node.defaultChild as CfnStage;
    cfnStage.defaultRouteSettings = {
      throttlingRateLimit: PUBLIC_API_DEFAULT_THROTTLE.rateLimit,
      throttlingBurstLimit: PUBLIC_API_DEFAULT_THROTTLE.burstLimit,
    };
    cfnStage.routeSettings = Object.fromEntries(
      Object.entries(PUBLIC_API_ROUTE_THROTTLES).map(([routeKey, limits]) => [
        routeKey,
        { ThrottlingRateLimit: limits.rateLimit, ThrottlingBurstLimit: limits.burstLimit },
      ])
    );
    for (const route of throttledRoutes) {
      cfnStage.node.addDependency(route);
    }
  }
}
