import { RemovalPolicy } from "aws-cdk-lib";
import { AttributeType, TableV2 } from "aws-cdk-lib/aws-dynamodb";
import type { Construct } from "constructs";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface ContactsTableProps {
  envName: Nyc311Environment;
}

/**
 * Backs `Contact` (`16-resident-action-models.md` §3) — `contact_id` as the
 * sole key, no GSIs, no stream. Idempotency pointer rows
 * (`CRID#<client_request_id>`) share the same key space.
 */
export class ContactsTable extends TableV2 {
  constructor(scope: Construct, id: string, props: ContactsTableProps) {
    super(scope, id, {
      tableName: `Contacts-${ENV_NAME_SUFFIX[props.envName]}`,
      partitionKey: { name: "contact_id", type: AttributeType.STRING },
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      deletionProtection: props.envName === "PROD", /* v1-prod-deployment.md B9; Test stays deletable */
      removalPolicy: RemovalPolicy.RETAIN,
    });
  }
}
