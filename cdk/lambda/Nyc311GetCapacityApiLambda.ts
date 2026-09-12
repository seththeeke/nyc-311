import * as path from "node:path";
import { Duration } from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";
import type { OperatorsTable } from "../data/OperatorsTable";
import type { UsersTable } from "../data/UsersTable";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311GetCapacityApiLambdaProps {
  envName: Nyc311Environment;
  operatorsTable: OperatorsTable;
  usersTable: UsersTable;
}

/**
 * Backs the admin-authorized `GET /capacity` route
 * (`10-capacity-modeling-and-integration.md` §2.1) — entry point is
 * `backend/controller/web-api/getCapacityController.ts`. Read-only on
 * `OperatorsTable` (only `gsi2-roster` `Query`, per
 * `capacityService.getCapacityStatus`).
 */
export class Nyc311GetCapacityApiLambda extends NodejsFunction {
  constructor(scope: Construct, id: string, props: Nyc311GetCapacityApiLambdaProps) {
    const functionName = `Nyc311GetCapacityApi-${ENV_NAME_SUFFIX[props.envName]}`;

    const logGroup = new logs.LogGroup(scope, `${id}LogGroup`, {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: logs.RetentionDays.ONE_MONTH,
    });

    const backendRoot = path.join(__dirname, "..", "..", "backend");

    super(scope, id, {
      functionName,
      entry: path.join(backendRoot, "controller", "web-api", "getCapacityController.ts"),
      handler: "getCapacityController",
      runtime: Runtime.NODEJS_22_X,
      timeout: Duration.seconds(10),
      memorySize: 256,
      logGroup,
      projectRoot: backendRoot,
      depsLockFilePath: path.join(backendRoot, "package-lock.json"),
      environment: {
        OPERATORS_TABLE_NAME: props.operatorsTable.tableName,
        USERS_TABLE_NAME: props.usersTable.tableName,
      },
    });

    props.operatorsTable.grant(this, "dynamodb:Query");
    props.usersTable.grant(this, "dynamodb:Query", "dynamodb:PutItem");
  }
}
