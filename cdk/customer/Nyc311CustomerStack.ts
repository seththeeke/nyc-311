import { CfnOutput, Stack, type StackProps, Tags } from "aws-cdk-lib";
import type { Construct } from "constructs";
import { CustomerApi } from "./CustomerApi";
import { CustomerApiDomain } from "./CustomerApiDomain";
import { CUSTOMER_WEBHOOK_PATH } from "./customerConfig";
import { CustomerWebhookListenerLambda } from "./CustomerWebhookListenerLambda";
import { WebhookCustomerFacingOrdersTable } from "./WebhookCustomerFacingOrdersTable";

/**
 * The simulated customer (`13-customer-simulation.md`) — the second
 * standing exception to the single-stack rule (CLAUDE.md §5.3). Prod
 * only, and a real outsider: its own API, domain, table, Lambda and
 * roles, no reference to `Nyc311Stack` in either direction. First
 * milestone: a webhook listener that records which orders are in play.
 * Receives nothing until the manual launch steps in that doc's Appendix I.
 */
export class Nyc311CustomerStack extends Stack {
  /** The callback URL to register with the bureau. */
  public readonly webhookUrlOutput: CfnOutput;

  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    Tags.of(this).add("Environment", "PROD");
    Tags.of(this).add("System", "CUSTOMER");

    const ordersTable = new WebhookCustomerFacingOrdersTable(this, "WebhookCustomerFacingOrdersTable");
    const webhookListenerLambda = new CustomerWebhookListenerLambda(this, "CustomerWebhookListenerLambda", { ordersTable });
    const apiDomain = new CustomerApiDomain(this, "CustomerApiDomain");
    new CustomerApi(this, "CustomerApi", { webhookListenerLambda, apiDomainName: apiDomain.domainName });

    this.webhookUrlOutput = new CfnOutput(this, "CustomerWebhookUrl", {
      value: `${apiDomain.url}${CUSTOMER_WEBHOOK_PATH}`,
      description: "The callback URL to register with the bureau (13-customer-simulation.md Appendix I)",
    });
  }
}
