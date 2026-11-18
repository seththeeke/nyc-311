import * as path from "node:path";
import { Duration } from "aws-cdk-lib";
import type { ICommandHooks } from "aws-cdk-lib/aws-lambda-nodejs";
import type * as sns from "aws-cdk-lib/aws-sns";
import type { Construct } from "constructs";
import type { ContactsTable } from "../data/ContactsTable";
import type { LocationsTable } from "../data/LocationsTable";
import type { OrdersTable } from "../data/OrdersTable";
import type { Nyc311Environment } from "../stack/Nyc311Stack";
import { Nyc311Function } from "./Nyc311Function";

export interface Nyc311PublicApiLambdaProps {
  envName: Nyc311Environment;
  /** `SEARCH_REQUESTS` — the Order projection and its rejection event. */
  ordersTable: OrdersTable;
  /** `SEARCH_REQUESTS` — the Order's Location. */
  locationsTable: LocationsTable;
  /** Feature requests — Contacts and their idempotency pointers. */
  contactsTable: ContactsTable;
  /** One message per call, for the `public_api_calls` warehouse table (§4). */
  publicApiCallsTopic: sns.ITopic;
}

/* The spec, relative to backend/, copied beside the bundled handler so publicApiService can serve it. */
const OPENAPI_SPEC = path.join("controller", "web-api", "publicV1", "openapi.yaml");

/* esbuild hooks: the only step is copying the spec in after bundling. */
export const PUBLIC_API_BUNDLING_HOOKS: ICommandHooks = {
  beforeBundling: () => [],
  beforeInstall: () => [],
  afterBundling: (inputDir: string, outputDir: string) => [
    `cp "${path.join(inputDir, OPENAPI_SPEC)}" "${path.join(outputDir, "openapi.yaml")}"`,
  ],
};

/**
 * The public API's one bundle Lambda (`16-resident-action-models.md` §2.3),
 * entry `backend/controller/web-api/publicV1/publicV1ApiRouter.ts`, serving
 * every `/v1/` route. Reads Orders and Locations (search); reads and
 * creates Contacts (feature requests), never updates or deletes them.
 */
export class Nyc311PublicApiLambda extends Nyc311Function {
  constructor(scope: Construct, id: string, props: Nyc311PublicApiLambdaProps) {
    super(scope, id, {
      envName: props.envName,
      name: "Nyc311PublicV1Api",
      entry: ["controller", "web-api", "publicV1", "publicV1ApiRouter.ts"],
      handler: "publicV1ApiRouter",
      commandHooks: PUBLIC_API_BUNDLING_HOOKS,
      timeout: Duration.seconds(10),
      memorySize: 512,
      environment: {
        ORDERS_TABLE_NAME: props.ordersTable.tableName,
        LOCATIONS_TABLE_NAME: props.locationsTable.tableName,
        CONTACTS_TABLE_NAME: props.contactsTable.tableName,
        PUBLIC_API_CALLS_TOPIC_ARN: props.publicApiCallsTopic.topicArn,
      },
    });

    props.ordersTable.grant(this, "dynamodb:GetItem", "dynamodb:Query");
    props.locationsTable.grant(this, "dynamodb:GetItem");
    /* A create is one TransactWriteItems of two conditional Puts; a replay reads the pointer and the original. */
    props.contactsTable.grant(this, "dynamodb:GetItem", "dynamodb:PutItem");
    props.publicApiCallsTopic.grantPublish(this);
  }
}
