import * as path from "node:path";
import { Duration } from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";
import type { OperatorsTable } from "../data/OperatorsTable";
import type { UsersTable } from "../data/UsersTable";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311RemoveCapacityApiLambdaProps {
  envName: Nyc311Environment;
  operatorsTable: OperatorsTable;
  usersTable: UsersTable;
}

/**
 * Backs the admin-authorized `DELETE /capacity/{operator_id}` route
 * (`10-capacity-modeling-and-integration.md` §2.1) — entry point is
 * `backend/controller/web-api/removeCapacityController.ts`.
 */
export class Nyc311RemoveCapacityApiLambda extends NodejsFunction {
  constructor(scope: Construct, id: string, props: Nyc311RemoveCapacityApiLambdaProps) {
    const functionName = `Nyc311RemoveCapacityApi-${ENV_NAME_SUFFIX[props.envName]}`;

    const logGroup = new logs.LogGroup(scope, `${id}LogGroup`, {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: logs.RetentionDays.ONE_MONTH,
    });

    const backendRoot = path.join(__dirname, "..", "..", "backend");

    super(scope, id, {
      functionName,
      entry: path.join(backendRoot, "controller", "web-api", "removeCapacityController.ts"),
      handler: "removeCapacityController",
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

    props.operatorsTable.grant(this, "dynamodb:GetItem", "dynamodb:PutItem");
    props.usersTable.grant(this, "dynamodb:Query", "dynamodb:PutItem");
  }
}
