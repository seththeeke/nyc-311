import * as path from "node:path";
import { Duration } from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";
import type { OperatorsTable } from "../data/OperatorsTable";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311GetFleetLocationsApiLambdaProps {
  envName: Nyc311Environment;
  operatorsTable: OperatorsTable;
}

/**
 * Backs the public `GET /fleet/locations` route
 * (`10-capacity-modeling-and-integration.md` §6.1) — the home-page map's
 * data source. Entry: `backend/controller/web-api/
 * getFleetLocationsController.ts`. Unlike the capacity Lambdas, no
 * UsersTable grant — this route is public, no `requireAdminUser` call.
 * Read-only on `OperatorsTable` (`gsi2-roster` `Query`, same as
 * `Nyc311GetCapacityApiLambda`).
 */
export class Nyc311GetFleetLocationsApiLambda extends NodejsFunction {
  constructor(scope: Construct, id: string, props: Nyc311GetFleetLocationsApiLambdaProps) {
    const functionName = `Nyc311GetFleetLocationsApi-${ENV_NAME_SUFFIX[props.envName]}`;

    const logGroup = new logs.LogGroup(scope, `${id}LogGroup`, {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: logs.RetentionDays.ONE_MONTH,
    });

    const backendRoot = path.join(__dirname, "..", "..", "backend");

    super(scope, id, {
      functionName,
      entry: path.join(backendRoot, "controller", "web-api", "getFleetLocationsController.ts"),
      handler: "getFleetLocationsController",
      runtime: Runtime.NODEJS_22_X,
      timeout: Duration.seconds(10),
      memorySize: 256,
      logGroup,
      projectRoot: backendRoot,
      depsLockFilePath: path.join(backendRoot, "package-lock.json"),
      environment: {
        OPERATORS_TABLE_NAME: props.operatorsTable.tableName,
      },
    });

    props.operatorsTable.grant(this, "dynamodb:Query");
  }
}
