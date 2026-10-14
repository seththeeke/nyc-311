import { CfnStage, HttpApi, HttpMethod, type IDomainName } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import type { Construct } from "constructs";
import { CUSTOMER_ENV_SUFFIX, CUSTOMER_WEBHOOK_PATH } from "./customerConfig";
import type { CustomerWebhookListenerLambda } from "./CustomerWebhookListenerLambda";

export interface CustomerApiProps {
  webhookListenerLambda: CustomerWebhookListenerLambda;
  /** The customer API's own custom domain (`CustomerApiDomain`) — mapped as the default domain. */
  apiDomainName: IDomainName;
}

/* Crude, free abuse protection, same approach as the bureau's API: a stage default plus a route limit. */
export const CUSTOMER_DEFAULT_THROTTLE = { rateLimit: 10, burstLimit: 20 };
/* The bureau sends at most two deliveries at once, so this only ever limits strangers. */
export const CUSTOMER_WEBHOOK_THROTTLE = { rateLimit: 5, burstLimit: 10 };

/**
 * The customer's own API Gateway (an HTTP API) — nothing shared with the
 * bureau's. One route today, the webhook listener; it has no authorizer
 * because every delivery is authenticated by its signature. The public
 * read routes of `13-customer-simulation.md` §4 join it later.
 */
export class CustomerApi extends HttpApi {
  constructor(scope: Construct, id: string, props: CustomerApiProps) {
    super(scope, id, {
      apiName: `Nyc311CustomerApi-${CUSTOMER_ENV_SUFFIX}`,
      defaultDomainMapping: { domainName: props.apiDomainName },
    });

    const webhookRoutes = this.addRoutes({
      path: CUSTOMER_WEBHOOK_PATH,
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration("ReceiveWebhookIntegration", props.webhookListenerLambda),
    });

    /* The L2 HttpApi exposes no throttle for its $default stage, so set it on the L1; routeSettings must name existing routes. */
    const cfnStage = this.defaultStage?.node.defaultChild as CfnStage;
    cfnStage.defaultRouteSettings = {
      throttlingRateLimit: CUSTOMER_DEFAULT_THROTTLE.rateLimit,
      throttlingBurstLimit: CUSTOMER_DEFAULT_THROTTLE.burstLimit,
    };
    cfnStage.routeSettings = {
      [`POST ${CUSTOMER_WEBHOOK_PATH}`]: {
        ThrottlingRateLimit: CUSTOMER_WEBHOOK_THROTTLE.rateLimit,
        ThrottlingBurstLimit: CUSTOMER_WEBHOOK_THROTTLE.burstLimit,
      },
    };
    for (const route of webhookRoutes) {
      cfnStage.node.addDependency(route);
    }
  }
}
