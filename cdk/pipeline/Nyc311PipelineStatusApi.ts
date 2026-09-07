import { Duration } from "aws-cdk-lib";
import { CorsHttpMethod, HttpApi, HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import type { Construct } from "constructs";
import type { Nyc311PipelineStatusLambda } from "./Nyc311PipelineStatusLambda";

export interface Nyc311PipelineStatusApiProps {
  pipelineStatusLambda: Nyc311PipelineStatusLambda;
}

/*
 * The web origins that call this singleton API — hardcoded, not
 * cross-stack-referenced (2-pipeline-monitoring.md §7); update by hand if
 * a site domain changes. Custom domains are primary; the `*.cloudfront.net`
 * defaults stay for now per 8-domain-name-assignment.md §4 (issue #4's
 * "keep both") so the tile survives DNS/cert propagation lag.
 */
const WEB_ORIGINS = [
  "https://test.boroughsim.com",
  "https://boroughsim.com",
  "https://d3u5wagmbm10bm.cloudfront.net",
  "https://d3n0h6hoc7c771.cloudfront.net",
];

/* The web-app's Vite dev server default port (web-app/vite.config.ts). */
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
        allowOrigins: [...WEB_ORIGINS, LOCAL_DEV_ORIGIN],
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
