import { Duration } from "aws-cdk-lib";
import { CorsHttpMethod, HttpApi, HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import type { Construct } from "constructs";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";
import type { Nyc311MetricsApiLambda } from "../lambda/Nyc311MetricsApiLambda";

export interface Nyc311ApiProps {
  envName: Nyc311Environment;
  metricsApiLambda: Nyc311MetricsApiLambda;
  /** WebsiteHosting's CloudFront `distribution.domainName` — allowed by CORS alongside local dev. */
  webAppDomainName: string;
}

/*
 * The web-app's Vite dev server default port (web-app/vite.config.ts) —
 * allowed by CORS so the "live" data mode can be exercised against a
 * deployed Test API without a browser-side CORS error during local dev.
 */
const LOCAL_DEV_ORIGIN = "http://localhost:5173";

/**
 * The public web API Gateway (`claude-prompt-initial.md` §5/§7) — the
 * first API Gateway in the project. An HTTP API (`aws-apigatewayv2`), not
 * a REST API (`aws-apigateway`): cheaper and simpler, and sufficient for
 * this project's basic GET-only REST surface (1-data-ingestion.md §8a).
 *
 * First and only route today: `GET /ingestion/metrics`.
 */
export class Nyc311Api extends HttpApi {
  constructor(scope: Construct, id: string, props: Nyc311ApiProps) {
    const suffix = ENV_NAME_SUFFIX[props.envName];

    super(scope, id, {
      apiName: `Nyc311Api-${suffix}`,
      corsPreflight: {
        allowOrigins: [`https://${props.webAppDomainName}`, LOCAL_DEV_ORIGIN],
        allowMethods: [CorsHttpMethod.GET],
        allowHeaders: ["Content-Type"],
        maxAge: Duration.days(1),
      },
    });

    this.addRoutes({
      path: "/ingestion/metrics",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("GetPollerMetricsIntegration", props.metricsApiLambda),
    });
  }
}
