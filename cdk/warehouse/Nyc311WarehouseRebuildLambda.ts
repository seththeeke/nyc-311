import { Duration } from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import type { Construct } from "constructs";
import type { WarehouseJobRunsTable } from "../data/WarehouseJobRunsTable";
import type { Nyc311WarehouseBucket } from "./Nyc311WarehouseBucket";
import type { Nyc311WarehouseFirehose } from "./Nyc311WarehouseFirehose";
import type { Nyc311Environment } from "../stack/Nyc311Stack";
import { Nyc311Function } from "../lambda/Nyc311Function";

export interface Nyc311WarehouseRebuildLambdaProps {
  envName: Nyc311Environment;
  warehouseBucket: Nyc311WarehouseBucket;
  jobRunsTable: WarehouseJobRunsTable;
  /** The four per-table warehouse Firehoses — replay `PutRecordBatch`es straight onto these, bypassing SNS. */
  orderEventsFirehose: Nyc311WarehouseFirehose;
  orderSnapshotsFirehose: Nyc311WarehouseFirehose;
  requestsFirehose: Nyc311WarehouseFirehose;
  locationsFirehose: Nyc311WarehouseFirehose;
}

/**
 * The rebuild worker (`7-data-warehousing.md` §10) — one invocation per
 * branch of `Nyc311WarehouseRebuildStateMachine`. Wipes `data/<table>/`
 * for the source's warehouse table(s), then replays the PITR export's
 * gzipped DynamoDB-JSON rows through the live per-table Firehose. Entry:
 * `backend/controller/data-archival/warehouseRebuildController.ts`.
 * Least-privilege: S3 read on `export-staging/*`, list + delete on
 * `data/*`, `firehose:PutRecordBatch` on the four streams,
 * `WarehouseJobRuns` write.
 */
export class Nyc311WarehouseRebuildLambda extends Nyc311Function {
  constructor(scope: Construct, id: string, props: Nyc311WarehouseRebuildLambdaProps) {
    const firehoses = [
      props.orderEventsFirehose,
      props.orderSnapshotsFirehose,
      props.requestsFirehose,
      props.locationsFirehose,
    ];

    super(scope, id, {
      envName: props.envName,
      /* "Worker" distinguishes it from Nyc311WarehouseRebuild-<env>, the state machine that invokes it. */
      name: "Nyc311WarehouseRebuildWorker",
      entry: ["controller", "data-archival", "warehouseRebuildController.ts"],
      handler: "warehouseRebuildController",
      /* One export (< 500 MB / < 1M rows at this project's scale) unmarshalled + PutRecordBatch'd — minutes, not the full 15. */
      timeout: Duration.minutes(15),
      memorySize: 1024,
      environment: {
        WAREHOUSE_BUCKET_NAME: props.warehouseBucket.bucketName,
        WAREHOUSE_JOB_RUNS_TABLE_NAME: props.jobRunsTable.tableName,
        ORDER_EVENTS_FIREHOSE_NAME: props.orderEventsFirehose.deliveryStream.deliveryStreamName,
        ORDER_SNAPSHOTS_FIREHOSE_NAME: props.orderSnapshotsFirehose.deliveryStream.deliveryStreamName,
        REQUESTS_FIREHOSE_NAME: props.requestsFirehose.deliveryStream.deliveryStreamName,
        LOCATIONS_FIREHOSE_NAME: props.locationsFirehose.deliveryStream.deliveryStreamName,
      },
    });

    props.jobRunsTable.grant(this, "dynamodb:PutItem");

    const bucketArn = props.warehouseBucket.bucket.bucketArn;
    this.addToRolePolicy(
      new iam.PolicyStatement({ actions: ["s3:ListBucket"], resources: [bucketArn] })
    );
    this.addToRolePolicy(
      new iam.PolicyStatement({ actions: ["s3:GetObject"], resources: [`${bucketArn}/export-staging/*`] })
    );
    this.addToRolePolicy(
      new iam.PolicyStatement({
        /* wipe: empties data/<table>/ before the replay; finalize: drops the consumed export-staging/<source>/ */
        actions: ["s3:DeleteObject"],
        resources: [`${bucketArn}/data/*`, `${bucketArn}/export-staging/*`],
      })
    );
    this.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["firehose:PutRecordBatch"],
        resources: firehoses.map((f) => f.deliveryStream.deliveryStreamArn),
      })
    );
  }
}
