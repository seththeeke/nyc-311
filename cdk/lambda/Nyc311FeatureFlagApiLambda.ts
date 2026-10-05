import * as path from "node:path";
import { Duration, RemovalPolicy } from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { NYC311_LAMBDA_BUNDLING } from "./lambdaBundling";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";
import type { FeatureFlagsTable } from "../data/FeatureFlagsTable";
import type { UsersTable } from "../data/UsersTable";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export const FEATURE_FLAG_API_OPERATIONS = ["LIST", "GET", "GET_TREATMENT", "CREATE", "UPDATE", "DELETE"] as const;
export type FeatureFlagApiOperation = (typeof FEATURE_FLAG_API_OPERATIONS)[number];

interface OperationConfig {
  /** Physical-name stem, suffixed `-<Env>`. */
  functionStem: string;
  /** Exported handler in `backend/controller/web-api/<controller>.ts`. */
  controller: string;
  tableActions: string[];
  /** Admin operations resolve the caller via `requireAdminUser`, so they need UsersTable. */
  admin: boolean;
}

export const FEATURE_FLAG_OPERATION_CONFIG: Record<FeatureFlagApiOperation, OperationConfig> = {
  LIST: { functionStem: "Nyc311ListFeatureFlagsApi", controller: "listFeatureFlagsController", tableActions: ["dynamodb:Scan"], admin: false },
  GET: { functionStem: "Nyc311GetFeatureFlagApi", controller: "getFeatureFlagController", tableActions: ["dynamodb:GetItem"], admin: false },
  GET_TREATMENT: { functionStem: "Nyc311GetTreatmentApi", controller: "getTreatmentController", tableActions: ["dynamodb:GetItem"], admin: false },
  CREATE: { functionStem: "Nyc311CreateFeatureFlagApi", controller: "createFeatureFlagController", tableActions: ["dynamodb:PutItem"], admin: true },
  UPDATE: {
    functionStem: "Nyc311UpdateFeatureFlagApi",
    controller: "updateFeatureFlagController",
    tableActions: ["dynamodb:GetItem", "dynamodb:PutItem"],
    admin: true,
  },
  DELETE: { functionStem: "Nyc311DeleteFeatureFlagApi", controller: "deleteFeatureFlagController", tableActions: ["dynamodb:DeleteItem"], admin: true },
};

export interface Nyc311FeatureFlagApiLambdaProps {
  envName: Nyc311Environment;
  operation: FeatureFlagApiOperation;
  featureFlagsTable: FeatureFlagsTable;
  usersTable: UsersTable;
}

/**
 * One route of the feature-flag service (`11-street-condition-implementation.md`
 * §4.2) — a single construct parameterized by operation rather than six
 * near-identical files. Each instance gets only its own operation's
 * FeatureFlagsTable actions; only admin operations get UsersTable.
 */
export class Nyc311FeatureFlagApiLambda extends NodejsFunction {
  constructor(scope: Construct, id: string, props: Nyc311FeatureFlagApiLambdaProps) {
    const config = FEATURE_FLAG_OPERATION_CONFIG[props.operation];
    const functionName = `${config.functionStem}-${ENV_NAME_SUFFIX[props.envName]}`;

    const logGroup = new logs.LogGroup(scope, `${id}LogGroup`, {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const backendRoot = path.join(__dirname, "..", "..", "backend");

    super(scope, id, {
      functionName,
      entry: path.join(backendRoot, "controller", "web-api", `${config.controller}.ts`),
      handler: config.controller,
      runtime: Runtime.NODEJS_22_X,
      bundling: NYC311_LAMBDA_BUNDLING,
      timeout: Duration.seconds(10),
      memorySize: 512,
      logGroup,
      projectRoot: backendRoot,
      depsLockFilePath: path.join(backendRoot, "package-lock.json"),
      environment: {
        FEATURE_FLAGS_TABLE_NAME: props.featureFlagsTable.tableName,
        ...(config.admin ? { USERS_TABLE_NAME: props.usersTable.tableName } : {}),
      },
    });

    props.featureFlagsTable.grant(this, ...config.tableActions);
    if (config.admin) {
      props.usersTable.grant(this, "dynamodb:Query", "dynamodb:PutItem");
    }
  }
}
