import * as path from "node:path";
import { Duration, RemovalPolicy } from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { NYC311_LAMBDA_BUNDLING } from "./lambdaBundling";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";
import type { FeatureFlagsTable } from "../data/FeatureFlagsTable";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311FeatureFlagsApiLambdaProps {
  envName: Nyc311Environment;
  featureFlagsTable: FeatureFlagsTable;
}

/**
 * The featureFlags Service API bundle (`15-resource-consolidation.md`
 * §3.3): the three public flag routes, entry
 * `backend/controller/web-api/featureFlags/featureFlagsApiRouter.ts`.
 * Read-only on the flags table — the writes are admin routes.
 */
export class Nyc311FeatureFlagsApiLambda extends NodejsFunction {
  constructor(scope: Construct, id: string, props: Nyc311FeatureFlagsApiLambdaProps) {
    const functionName = `Nyc311FeatureFlagsApi-${ENV_NAME_SUFFIX[props.envName]}`;

    const logGroup = new logs.LogGroup(scope, `${id}LogGroup`, {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const backendRoot = path.join(__dirname, "..", "..", "backend");

    super(scope, id, {
      functionName,
      entry: path.join(backendRoot, "controller", "web-api", "featureFlags", "featureFlagsApiRouter.ts"),
      handler: "featureFlagsApiRouter",
      runtime: Runtime.NODEJS_22_X,
      bundling: NYC311_LAMBDA_BUNDLING,
      timeout: Duration.seconds(10),
      memorySize: 512,
      logGroup,
      projectRoot: backendRoot,
      depsLockFilePath: path.join(backendRoot, "package-lock.json"),
      environment: {
        FEATURE_FLAGS_TABLE_NAME: props.featureFlagsTable.tableName,
      },
    });

    props.featureFlagsTable.grant(this, "dynamodb:Scan", "dynamodb:GetItem");
  }
}
