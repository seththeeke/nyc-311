import * as path from "node:path";
import { Duration } from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311WarehouseTransformLambdaProps {
  envName: Nyc311Environment;
}

/**
 * The Kinesis Data Firehose data-transformation Lambda shared by all
 * three warehouse delivery streams (`7-data-warehousing.md` §5/§7) — per
 * record it re-serializes the opaque JSON fields to strings and stamps
 * `warehouse_ingested_at`/`ingestion_source`, so the record matches the
 * Glue Parquet schema. No DAO/table access — pure record shaping.
 */
export class Nyc311WarehouseTransformLambda extends NodejsFunction {
  constructor(scope: Construct, id: string, props: Nyc311WarehouseTransformLambdaProps) {
    const suffix = ENV_NAME_SUFFIX[props.envName];
    const functionName = `Nyc311WarehouseTransform-${suffix}`;

    const logGroup = new logs.LogGroup(scope, `${id}LogGroup`, {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: logs.RetentionDays.ONE_MONTH,
    });

    const backendRoot = path.join(__dirname, "..", "..", "backend");

    super(scope, id, {
      functionName,
      entry: path.join(backendRoot, "controller", "data-archival", "warehouseRecordTransformController.ts"),
      handler: "warehouseRecordTransformController",
      runtime: Runtime.NODEJS_22_X,
      /* Firehose caps a transformation invocation at 5 minutes; 60s covers a 3 MB / 300s buffer of tiny records. */
      timeout: Duration.seconds(60),
      memorySize: 256,
      logGroup,
      projectRoot: backendRoot,
      depsLockFilePath: path.join(backendRoot, "package-lock.json"),
    });
  }
}
