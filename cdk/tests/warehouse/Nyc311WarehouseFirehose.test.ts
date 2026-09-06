import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import * as sns from "aws-cdk-lib/aws-sns";
import { describe, it } from "vitest";
import { Nyc311WarehouseBucket } from "../../warehouse/Nyc311WarehouseBucket";
import { Nyc311WarehouseCatalog } from "../../warehouse/Nyc311WarehouseCatalog";
import { Nyc311WarehouseTransformLambda } from "../../warehouse/Nyc311WarehouseTransformLambda";
import { Nyc311WarehouseFirehose } from "../../warehouse/Nyc311WarehouseFirehose";

function synth(envName: "TEST" | "PROD"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  const warehouseBucket = new Nyc311WarehouseBucket(stack, "Nyc311WarehouseBucket", { envName });
  const catalog = new Nyc311WarehouseCatalog(stack, "Nyc311WarehouseCatalog", { envName, warehouseBucket });
  const transformLambda = new Nyc311WarehouseTransformLambda(stack, "Nyc311WarehouseTransformLambda", { envName });
  const topic = new sns.Topic(stack, "SourceTopic", { topicName: "Nyc311OrderEvents-Test" });
  new Nyc311WarehouseFirehose(stack, "Nyc311WarehouseOrderEventsFirehose", {
    envName,
    label: "OrderEvents",
    tableName: "order_events",
    sourceTopic: topic,
    glueTable: catalog.tables["order_events"],
    warehouseBucket,
    transformLambda,
  });
  return Template.fromStack(stack);
}

describe("Nyc311WarehouseFirehose", () => {
  it("names the delivery stream per label + environment", () => {
    synth("TEST").hasResourceProperties("AWS::KinesisFirehose::DeliveryStream", {
      DeliveryStreamName: "Nyc311Warehouse-OrderEvents-Test",
    });
    synth("PROD").hasResourceProperties("AWS::KinesisFirehose::DeliveryStream", {
      DeliveryStreamName: "Nyc311Warehouse-OrderEvents-Prod",
    });
  });

  it("lands data under data/<table>/dt=<date>/ and errors under errors/<table>/, buffering 64MB/300s", () => {
    synth("TEST").hasResourceProperties("AWS::KinesisFirehose::DeliveryStream", {
      ExtendedS3DestinationConfiguration: Match.objectLike({
        Prefix: "data/order_events/dt=!{timestamp:yyyy-MM-dd}/",
        ErrorOutputPrefix: "errors/order_events/!{firehose:error-output-type}/dt=!{timestamp:yyyy-MM-dd}/",
        BufferingHints: { IntervalInSeconds: 300, SizeInMBs: 64 },
      }),
    });
  });

  it("converts JSON to Parquet against the source's Glue table", () => {
    synth("TEST").hasResourceProperties("AWS::KinesisFirehose::DeliveryStream", {
      ExtendedS3DestinationConfiguration: Match.objectLike({
        DataFormatConversionConfiguration: Match.objectLike({
          Enabled: true,
          OutputFormatConfiguration: {
            Serializer: { ParquetSerDe: Match.anyValue() },
          },
          SchemaConfiguration: Match.objectLike({ DatabaseName: "nyc311_warehouse_test" }),
        }),
      }),
    });
  });

  it("runs the transform Lambda as a processor", () => {
    synth("TEST").hasResourceProperties("AWS::KinesisFirehose::DeliveryStream", {
      ExtendedS3DestinationConfiguration: Match.objectLike({
        ProcessingConfiguration: {
          Enabled: true,
          Processors: Match.arrayWith([Match.objectLike({ Type: "Lambda" })]),
        },
      }),
    });
  });

  it("subscribes the delivery stream to the source topic with raw message delivery", () => {
    synth("TEST").hasResourceProperties("AWS::SNS::Subscription", {
      Protocol: "firehose",
      RawMessageDelivery: true,
      TopicArn: { Ref: Match.stringLikeRegexp("^SourceTopic") },
    });
  });
});
