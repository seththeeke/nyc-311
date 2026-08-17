import { Duration } from "aws-cdk-lib";
import { CorsHttpMethod, HttpApi, HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import type { Construct } from "constructs";
import type { Nyc311PipelineStatusLambda } from "./Nyc311PipelineStatusLambda";

export interface Nyc311PipelineStatusApiProps {
  pipelineStatusLambda: Nyc311PipelineStatusLambda;
}

// Nyc311Web-Test / Nyc311Web-Prod CloudFront distributions
// (cdk/web/WebsiteHosting.ts) — hardcoded, not cross-stack-referenced.
// See 2-pipeline-monitoring.md §7 for why: this API is a singleton living
// in Nyc311PipelineStack, but both the Test and Prod sites (deployed from
// the separate, per-environment Nyc311Stack) call it, so its CORS
// allow-list needs both domains. A cross-stack SSM-parameter lookup was
// considered and rejected as unnecessary coupling for a scenario (a
// WebsiteHosting CloudFront distribution being replaced) that's unlikely
// in practice — if it ever happens, these two lines need a manual update.
const TEST_WEB_DOMAIN = "d3u5wagmbm10bm.cloudfront.net";
const PROD_WEB_DOMAIN = "d3n0h6hoc7c771.cloudfront.net";

// The web-app's Vite dev server default port (web-app/vite.config.ts).
const LOCAL_DEV_ORIGIN = "http://localhost:5173";

/**
 * A second, separate HTTP API from `Nyc311Api` — deliberately, per
 * `2-pipeline-monitoring.md` §1/§2: this reports on `Nyc311Pipeline`
 * itself, a singleton resource, not on anything per-environment, so it
 * doesn't belong bundled onto the per-environment `Nyc311Api`. Living in
 * `Nyc311PipelineStack` alongside the Lambda it fronts.
 *
 * First and only route today: `GET /pipeline/status`.
 */
export class Nyc311PipelineStatusApi extends HttpApi {
  constructor(scope: Construct, id: string, props: Nyc311PipelineStatusApiProps) {
    super(scope, id, {
      apiName: "Nyc311PipelineStatusApi",
      corsPreflight: {
        allowOrigins: [`https://${TEST_WEB_DOMAIN}`, `https://${PROD_WEB_DOMAIN}`, LOCAL_DEV_ORIGIN],
        allowMethods: [CorsHttpMethod.GET],
        allowHeaders: ["Content-Type"],
        maxAge: Duration.days(1),
      },
    });

    this.addRoutes({
      path: "/pipeline/status",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("GetPipelineStatusIntegration", props.pipelineStatusLambda),
    });
  }
}
