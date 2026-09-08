import * as path from "node:path";
import { Duration, RemovalPolicy } from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";
import type { WarehouseJobRunsTable } from "../data/WarehouseJobRunsTable";
import type { Nyc311WarehouseBucket } from "./Nyc311WarehouseBucket";
import type { Nyc311WarehouseFirehose } from "./Nyc311WarehouseFirehose";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

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
export class Nyc311WarehouseRebuildLambda extends NodejsFunction {
  constructor(scope: Construct, id: string, props: Nyc311WarehouseRebuildLambdaProps) {
    const suffix = ENV_NAME_SUFFIX[props.envName];
    /* "Worker" distinguishes it from Nyc311WarehouseRebuild-<env>, the state machine that invokes it. */
    const functionName = `Nyc311WarehouseRebuildWorker-${suffix}`;

    const logGroup = new logs.LogGroup(scope, `${id}LogGroup`, {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const backendRoot = path.join(__dirname, "..", "..", "backend");

    const firehoses = [
      props.orderEventsFirehose,
      props.orderSnapshotsFirehose,
      props.requestsFirehose,
      props.locationsFirehose,
    ];

    super(scope, id, {
      functionName,
      entry: path.join(backendRoot, "controller", "data-archival", "warehouseRebuildController.ts"),
      handler: "warehouseRebuildController",
      runtime: Runtime.NODEJS_22_X,
      /* One export (< 500 MB / < 1M rows at this project's scale) unmarshalled + PutRecordBatch'd — minutes, not the full 15. */
      timeout: Duration.minutes(15),
      memorySize: 1024,
      logGroup,
      projectRoot: backendRoot,
      depsLockFilePath: path.join(backendRoot, "package-lock.json"),
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
      new iam.PolicyStatement({ actions: ["s3:DeleteObject"], resources: [`${bucketArn}/data/*`] })
    );
    this.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["firehose:PutRecordBatch"],
        resources: firehoses.map((f) => f.deliveryStream.deliveryStreamArn),
      })
    );
  }
}
