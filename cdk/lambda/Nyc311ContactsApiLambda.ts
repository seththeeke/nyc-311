import { Duration } from "aws-cdk-lib";
import type { Construct } from "constructs";
import type { ContactsTable } from "../data/ContactsTable";
import type { Nyc311Environment } from "../stack/Nyc311Stack";
import { Nyc311Function } from "./Nyc311Function";

export interface Nyc311ContactsApiLambdaProps {
  envName: Nyc311Environment;
  contactsTable: ContactsTable;
}

/**
 * The contacts Service API bundle (`17-executive-team.md` §17.3): the public
 * `GET /contacts`, entry
 * `backend/controller/web-api/contacts/contactsApiRouter.ts`. Query-only on
 * the Contacts table and its type index; the write is an admin route.
 */
export class Nyc311ContactsApiLambda extends Nyc311Function {
  constructor(scope: Construct, id: string, props: Nyc311ContactsApiLambdaProps) {
    super(scope, id, {
      envName: props.envName,
      name: "Nyc311ContactsApi",
      entry: ["controller", "web-api", "contacts", "contactsApiRouter.ts"],
      handler: "contactsApiRouter",
      timeout: Duration.seconds(10),
      memorySize: 512,
      environment: {
        CONTACTS_TABLE_NAME: props.contactsTable.tableName,
      },
    });

    props.contactsTable.grant(this, "dynamodb:Query");
  }
}
