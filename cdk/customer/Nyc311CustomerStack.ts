import { CfnOutput, Stack, type StackProps, Tags } from "aws-cdk-lib";
import type { Construct } from "constructs";
import { CustomerApi } from "./CustomerApi";
import { CustomerApiDomain } from "./CustomerApiDomain";
import { CUSTOMER_WEBHOOK_PATH } from "./customerConfig";
import { CustomerIdeaWorkerLambda } from "./CustomerIdeaWorkerLambda";
import { CustomerReadApiLambda } from "./CustomerReadApiLambda";
import { CustomerResidentSchedules } from "./CustomerResidentSchedules";
import { CustomerResidentSync } from "./CustomerResidentSync";
import { CustomerResidentSyncLambda } from "./CustomerResidentSyncLambda";
import { CustomerWebhookListenerLambda } from "./CustomerWebhookListenerLambda";
import { ResidentIdeasTable } from "./ResidentIdeasTable";
import { loadResidentSeeds } from "./residentSeedFiles";
import { ResidentsTable } from "./ResidentsTable";
import { WebhookCustomerFacingOrdersTable } from "./WebhookCustomerFacingOrdersTable";

/**
 * The simulated customer (`13-customer-simulation.md`) — the second
 * standing exception to the single-stack rule (CLAUDE.md §5.3). Prod
 * only, and a real outsider: its own API, domain, table, Lambda and
 * roles, no reference to `Nyc311Stack` either way. The listener records
 * which orders are in play; residents, synced from seeds, think on their
 * own schedules and record ideas; a public read API serves both to
 * BoroughSim's web-app. No actions yet.
 */
export class Nyc311CustomerStack extends Stack {
  /** The callback URL to register with BoroughSim. */
  public readonly webhookUrlOutput: CfnOutput;

  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    Tags.of(this).add("Environment", "PROD");
    Tags.of(this).add("System", "CUSTOMER");

    const ordersTable = new WebhookCustomerFacingOrdersTable(this, "WebhookCustomerFacingOrdersTable");
    const residentsTable = new ResidentsTable(this, "ResidentsTable");
    const ideasTable = new ResidentIdeasTable(this, "ResidentIdeasTable");
    const residents = loadResidentSeeds();

    const webhookListenerLambda = new CustomerWebhookListenerLambda(this, "CustomerWebhookListenerLambda", { ordersTable });
    const syncLambda = new CustomerResidentSyncLambda(this, "CustomerResidentSyncLambda", { residentsTable });
    new CustomerResidentSync(this, "CustomerResidentSync", { syncLambda });
    const ideaWorker = new CustomerIdeaWorkerLambda(this, "CustomerIdeaWorkerLambda", {
      residentsTable,
      ideasTable,
      ordersTable,
      modelIds: residents.map((resident) => resident.modelId),
    });
    new CustomerResidentSchedules(this, "CustomerResidentSchedules", { ideaWorker, residents });
    const readApiLambda = new CustomerReadApiLambda(this, "CustomerReadApiLambda", { residentsTable, ideasTable, ordersTable });

    const apiDomain = new CustomerApiDomain(this, "CustomerApiDomain");
    new CustomerApi(this, "CustomerApi", { webhookListenerLambda, readApiLambda, apiDomainName: apiDomain.domainName });

    this.webhookUrlOutput = new CfnOutput(this, "CustomerWebhookUrl", {
      value: `${apiDomain.url}${CUSTOMER_WEBHOOK_PATH}`,
      /* Unchanged deployed text: renaming it is an infrastructure change, deferred with the path itself. */
      description: "The callback URL to register with the bureau (13-customer-simulation.md Appendix I)",
    });
  }
}
