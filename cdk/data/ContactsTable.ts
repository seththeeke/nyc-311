import { RemovalPolicy } from "aws-cdk-lib";
import { AttributeType, TableV2 } from "aws-cdk-lib/aws-dynamodb";
import type { Construct } from "constructs";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface ContactsTableProps {
  envName: Nyc311Environment;
}

/**
 * Backs `Contact` (`16-resident-action-models.md` §3), keyed by `contact_id`,
 * with no stream. `ByTypeCreatedAt` lists Contacts by type in time order
 * (`17-executive-team.md` §17.3). Idempotency pointer rows
 * (`CRID#<client_request_id>`) share the key space but have no type, so the
 * index never holds them.
 */
export class ContactsTable extends TableV2 {
  constructor(scope: Construct, id: string, props: ContactsTableProps) {
    super(scope, id, {
      tableName: `Contacts-${ENV_NAME_SUFFIX[props.envName]}`,
      partitionKey: { name: "contact_id", type: AttributeType.STRING },
      globalSecondaryIndexes: [
        {
          indexName: "ByTypeCreatedAt",
          partitionKey: { name: "contact_type", type: AttributeType.STRING },
          sortKey: { name: "created_at", type: AttributeType.STRING },
        },
      ],
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      deletionProtection: props.envName === "PROD", /* v1-prod-deployment.md B9; Test stays deletable */
      removalPolicy: RemovalPolicy.RETAIN,
    });
  }
}
