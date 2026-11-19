import { Duration } from "aws-cdk-lib";
import type { Construct } from "constructs";
import type { Nyc311Environment } from "../stack/Nyc311Stack";
import { Nyc311Function } from "../lambda/Nyc311Function";

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
export class Nyc311WarehouseTransformLambda extends Nyc311Function {
  constructor(scope: Construct, id: string, props: Nyc311WarehouseTransformLambdaProps) {
    super(scope, id, {
      envName: props.envName,
      name: "Nyc311WarehouseTransform",
      entry: ["controller", "data-archival", "warehouseRecordTransformController.ts"],
      handler: "warehouseRecordTransformController",
      /* Firehose caps a transformation invocation at 5 minutes; 60s covers a 3 MB / 300s buffer of tiny records. */
      timeout: Duration.seconds(60),
      memorySize: 256,
      environment: {},
    });
  }
}
