import { Duration } from "aws-cdk-lib";
import type { Construct } from "constructs";
import type { FeatureFlagsTable } from "../data/FeatureFlagsTable";
import type { Nyc311Environment } from "../stack/Nyc311Stack";
import { Nyc311Function } from "./Nyc311Function";

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
export class Nyc311FeatureFlagsApiLambda extends Nyc311Function {
  constructor(scope: Construct, id: string, props: Nyc311FeatureFlagsApiLambdaProps) {
    super(scope, id, {
      envName: props.envName,
      name: "Nyc311FeatureFlagsApi",
      entry: ["controller", "web-api", "featureFlags", "featureFlagsApiRouter.ts"],
      handler: "featureFlagsApiRouter",
      timeout: Duration.seconds(10),
      memorySize: 512,
      environment: {
        FEATURE_FLAGS_TABLE_NAME: props.featureFlagsTable.tableName,
      },
    });

    props.featureFlagsTable.grant(this, "dynamodb:Scan", "dynamodb:GetItem");
  }
}
