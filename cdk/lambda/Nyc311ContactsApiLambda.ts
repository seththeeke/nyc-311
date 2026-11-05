import * as path from "node:path";
import { Duration, RemovalPolicy } from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { NYC311_LAMBDA_BUNDLING } from "./lambdaBundling";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";
import type { ContactsTable } from "../data/ContactsTable";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

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
export class Nyc311ContactsApiLambda extends NodejsFunction {
  constructor(scope: Construct, id: string, props: Nyc311ContactsApiLambdaProps) {
    const functionName = `Nyc311ContactsApi-${ENV_NAME_SUFFIX[props.envName]}`;

    const logGroup = new logs.LogGroup(scope, `${id}LogGroup`, {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const backendRoot = path.join(__dirname, "..", "..", "backend");

    super(scope, id, {
      functionName,
      entry: path.join(backendRoot, "controller", "web-api", "contacts", "contactsApiRouter.ts"),
      handler: "contactsApiRouter",
      runtime: Runtime.NODEJS_22_X,
      bundling: NYC311_LAMBDA_BUNDLING,
      timeout: Duration.seconds(10),
      memorySize: 512,
      logGroup,
      projectRoot: backendRoot,
      depsLockFilePath: path.join(backendRoot, "package-lock.json"),
      environment: {
        CONTACTS_TABLE_NAME: props.contactsTable.tableName,
      },
    });

    props.contactsTable.grant(this, "dynamodb:Query");
  }
}
