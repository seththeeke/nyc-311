import * as path from "node:path";
import { Duration } from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime, StartingPosition } from "aws-cdk-lib/aws-lambda";
import { DynamoEventSource, SqsDlq } from "aws-cdk-lib/aws-lambda-event-sources";
import * as logs from "aws-cdk-lib/aws-logs";
import * as sqs from "aws-cdk-lib/aws-sqs";
import type { Construct } from "constructs";
import type { LocationsTable } from "../data/LocationsTable";
import type { Nyc311LocationEventsTopic } from "./Nyc311LocationEventsTopic";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311LocationsFanOutLambdaProps {
  envName: Nyc311Environment;
  locationsTable: LocationsTable;
  locationEventsTopic: Nyc311LocationEventsTopic;
}

/* Locations trickle in one-per-bbl during request evaluation — a small batch drains a burst without a huge blast radius. */
const BATCH_SIZE = 50;

/* One consistent retry budget across the ingestion pipeline (matches the Requests/Orders fan-out Lambdas). */
const RETRY_ATTEMPTS = 3;

/**
 * The `Locations` table's sole DynamoDB Stream consumer
 * (`7-data-warehousing.md` §4). Publishes every new `Location` row
 * (`INSERT` only — `Locations` is never updated) onto
 * {@link Nyc311LocationEventsTopic}, tagged `event_name`, for the
 * `locations` warehouse Firehose. No DAO calls; `sns:Publish` only, no
 * `dynamodb:*` write; per-item failure isolation.
 */
export class Nyc311LocationsFanOutLambda extends NodejsFunction {
  public readonly fanOutLogGroup: logs.LogGroup;
  public readonly onFailureDeadLetterQueue: sqs.Queue;

  constructor(scope: Construct, id: string, props: Nyc311LocationsFanOutLambdaProps) {
    const suffix = ENV_NAME_SUFFIX[props.envName];
    const functionName = `Nyc311LocationsFanOut-${suffix}`;

    const fanOutLogGroup = new logs.LogGroup(scope, `${id}LogGroup`, {
      logGroupName: `/aws/lambda/${functionName}`, /* matches Lambda's own default log group naming convention */
      retention: logs.RetentionDays.ONE_MONTH,
    });

    const backendRoot = path.join(__dirname, "..", "..", "backend");

    super(scope, id, {
      functionName,
      entry: path.join(backendRoot, "controller", "ingestion", "fanOutLocationEventsController.ts"),
      handler: "fanOutLocationEventsController",
      runtime: Runtime.NODEJS_22_X,
      timeout: Duration.seconds(30),
      memorySize: 256,
      logGroup: fanOutLogGroup,
      projectRoot: backendRoot,
      depsLockFilePath: path.join(backendRoot, "package-lock.json"),
      environment: {
        LOCATION_EVENTS_TOPIC_ARN: props.locationEventsTopic.topic.topicArn,
      },
    });

    this.fanOutLogGroup = fanOutLogGroup;

    this.onFailureDeadLetterQueue = new sqs.Queue(this, "OnFailureDlq", {
      queueName: `Nyc311LocationsFanOutDlq-${suffix}`,
      retentionPeriod: Duration.days(14),
      enforceSSL: true,
    });

    this.addEventSource(
      new DynamoEventSource(props.locationsTable, {
        startingPosition: StartingPosition.LATEST,
        batchSize: BATCH_SIZE,
        reportBatchItemFailures: true,
        retryAttempts: RETRY_ATTEMPTS,
        onFailure: new SqsDlq(this.onFailureDeadLetterQueue),
      })
    );

    props.locationEventsTopic.topic.grantPublish(this);
  }
}
