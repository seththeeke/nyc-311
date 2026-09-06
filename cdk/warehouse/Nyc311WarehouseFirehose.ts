import { Duration, Size } from "aws-cdk-lib";
import * as firehose from "aws-cdk-lib/aws-kinesisfirehose";
import * as glue from "aws-cdk-lib/aws-glue";
import * as logs from "aws-cdk-lib/aws-logs";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import { Construct } from "constructs";
import type { Nyc311WarehouseBucket } from "./Nyc311WarehouseBucket";
import type { Nyc311WarehouseTransformLambda } from "./Nyc311WarehouseTransformLambda";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311WarehouseFirehoseProps {
  envName: Nyc311Environment;
  /** Short PascalCase label, e.g. "OrderEvents" — used in the delivery-stream name. */
  label: string;
  /** Glue table name AND the `data/<tableName>/` S3 sub-prefix. */
  tableName: string;
  /** The SNS topic this Firehose subscribes to (unfiltered, raw delivery). */
  sourceTopic: sns.ITopic;
  glueTable: glue.CfnTable;
  warehouseBucket: Nyc311WarehouseBucket;
  transformLambda: Nyc311WarehouseTransformLambda;
}

/*
 * §5 — the project's volume never fills 64 MB, so 300 s is the real flush
 * cadence; a report 5 minutes stale is fine.
 */
const BUFFERING_INTERVAL = Duration.seconds(300);
const BUFFERING_SIZE = Size.mebibytes(64);

/**
 * One warehouse delivery stream (`7-data-warehousing.md` §5): SNS →
 * Firehose (raw delivery) → transform Lambda → JSON→Parquet conversion
 * against the source's Glue table → `data/<table>/dt=<date>/` in the
 * warehouse bucket. Reusable — instantiated once per source table.
 */
export class Nyc311WarehouseFirehose extends Construct {
  public readonly deliveryStream: firehose.DeliveryStream;

  constructor(scope: Construct, id: string, props: Nyc311WarehouseFirehoseProps) {
    super(scope, id);

    const suffix = ENV_NAME_SUFFIX[props.envName];

    const logGroup = new logs.LogGroup(this, "LogGroup", {
      retention: logs.RetentionDays.ONE_MONTH,
    });

    const destination = new firehose.S3Bucket(props.warehouseBucket.bucket, {
      loggingConfig: new firehose.EnableLogging(logGroup),
      bufferingInterval: BUFFERING_INTERVAL,
      bufferingSize: BUFFERING_SIZE,
      dataOutputPrefix: `data/${props.tableName}/dt=!{timestamp:yyyy-MM-dd}/`,
      errorOutputPrefix: `errors/${props.tableName}/!{firehose:error-output-type}/dt=!{timestamp:yyyy-MM-dd}/`,
      processors: [
        new firehose.LambdaFunctionProcessor(props.transformLambda, {
          bufferInterval: Duration.seconds(60),
          bufferSize: Size.mebibytes(1),
          retries: 3,
        }),
      ],
      dataFormatConversion: {
        schemaConfiguration: firehose.SchemaConfiguration.fromCfnTable(props.glueTable),
        inputFormat: new firehose.OpenXJsonInputFormat(),
        outputFormat: new firehose.ParquetOutputFormat(),
      },
    });

    this.deliveryStream = new firehose.DeliveryStream(this, "Stream", {
      deliveryStreamName: `Nyc311Warehouse-${props.label}-${suffix}`,
      destination,
    });

    props.sourceTopic.addSubscription(
      new subscriptions.FirehoseSubscription(this.deliveryStream, { rawMessageDelivery: true })
    );
  }
}
