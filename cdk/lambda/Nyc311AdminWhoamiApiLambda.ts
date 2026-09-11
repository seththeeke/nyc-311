import * as path from "node:path";
import { Duration } from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";
import type { UsersTable } from "../data/UsersTable";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311AdminWhoamiApiLambdaProps {
  envName: Nyc311Environment;
  usersTable: UsersTable;
}

/**
 * Backs `GET /admin/whoami` (`9-admin-auth-integration.md` §8) — entry
 * point is `backend/controller/web-api/whoamiController.ts`. Grants
 * exactly `dynamodb:Query` (the `gsi1-cognito-sub` lookup) and
 * `dynamodb:PutItem` (get-or-create), matching
 * `userService.getOrCreateUser`'s DAO calls, nothing broader.
 */
export class Nyc311AdminWhoamiApiLambda extends NodejsFunction {
  constructor(scope: Construct, id: string, props: Nyc311AdminWhoamiApiLambdaProps) {
    const functionName = `Nyc311AdminWhoamiApi-${ENV_NAME_SUFFIX[props.envName]}`;

    const logGroup = new logs.LogGroup(scope, `${id}LogGroup`, {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: logs.RetentionDays.ONE_MONTH,
    });

    const backendRoot = path.join(__dirname, "..", "..", "backend");

    super(scope, id, {
      functionName,
      entry: path.join(backendRoot, "controller", "web-api", "whoamiController.ts"),
      handler: "whoamiController",
      runtime: Runtime.NODEJS_22_X,
      timeout: Duration.seconds(10),
      memorySize: 256,
      logGroup,
      projectRoot: backendRoot,
      depsLockFilePath: path.join(backendRoot, "package-lock.json"),
      environment: {
        USERS_TABLE_NAME: props.usersTable.tableName,
      },
    });

    props.usersTable.grant(this, "dynamodb:Query", "dynamodb:PutItem");
  }
}
