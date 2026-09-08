import { Duration, RemovalPolicy } from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as tasks from "aws-cdk-lib/aws-stepfunctions-tasks";
import { Construct } from "constructs";
import type { TableV2 } from "aws-cdk-lib/aws-dynamodb";
import type { IFunction } from "aws-cdk-lib/aws-lambda";
import type { Nyc311WarehouseBucket } from "../warehouse/Nyc311WarehouseBucket";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311WarehouseRebuildStateMachineProps {
  envName: Nyc311Environment;
  warehouseBucket: Nyc311WarehouseBucket;
  ordersTable: TableV2;
  requestsTable: TableV2;
  locationsTable: TableV2;
  /** `Nyc311WarehouseRebuildLambda` — one invocation per source, after that source's export completes. */
  rebuildLambda: IFunction;
  /** `Nyc311WarehouseJobRunnerLambda` — invoked once at the end so every job re-runs against the rebuilt data. */
  jobRunnerLambda: IFunction;
}

/** Poll cadence for `DescribeExport` — a PITR export of this project's tables completes in a few minutes. */
const EXPORT_POLL_INTERVAL = Duration.seconds(30);

/**
 * `Nyc311WarehouseRebuild` (`7-data-warehousing.md` §10) — manually
 * triggered (`test-scripts/5-warehouse-rebuild.py`), never scheduled.
 * Per source, in parallel: export the table pinned to the execution start
 * time, poll to `COMPLETED`, then invoke the rebuild worker Lambda. Live
 * capture is never paused. Once every branch finishes, `RecomputeJobs`
 * re-runs the job runner. The project's only state machine — justified by
 * the unbounded `DescribeExport` poll-wait, not orchestration.
 */
export class Nyc311WarehouseRebuildStateMachine extends Construct {
  public readonly stateMachine: sfn.StateMachine;

  constructor(scope: Construct, id: string, props: Nyc311WarehouseRebuildStateMachineProps) {
    super(scope, id);

    const suffix = ENV_NAME_SUFFIX[props.envName];

    const sourceTables: { source: string; table: TableV2 }[] = [
      { source: "orders", table: props.ordersTable },
      { source: "requests", table: props.requestsTable },
      { source: "locations", table: props.locationsTable },
    ];

    const branches = sourceTables.map(({ source, table }) => {
      const exportFailed = new sfn.Fail(this, `ExportFailed-${source}`, {
        causePath: "$.export.ExportDescription.FailureMessage",
      });

      const startExport = new tasks.CallAwsService(this, `StartExport-${source}`, {
        service: "dynamodb",
        action: "exportTableToPointInTime",
        parameters: {
          TableArn: table.tableArn,
          "ExportTime.$": "$$.Execution.StartTime",
          S3Bucket: props.warehouseBucket.bucketName,
          S3Prefix: `export-staging/${source}/`,
          ExportFormat: "DYNAMODB_JSON",
          S3SseAlgorithm: "AES256",
        },
        iamResources: [table.tableArn],
        iamAction: "dynamodb:ExportTableToPointInTime",
        resultPath: "$.export",
      });

      const wait = new sfn.Wait(this, `WaitExport-${source}`, { time: sfn.WaitTime.duration(EXPORT_POLL_INTERVAL) });

      const describe = new tasks.CallAwsService(this, `DescribeExport-${source}`, {
        service: "dynamodb",
        action: "describeExport",
        parameters: { "ExportArn.$": "$.export.ExportDescription.ExportArn" },
        iamResources: [`${table.tableArn}/export/*`],
        iamAction: "dynamodb:DescribeExport",
        resultPath: "$.export",
      });

      const rebuild = new tasks.LambdaInvoke(this, `Rebuild-${source}`, {
        lambdaFunction: props.rebuildLambda,
        payload: sfn.TaskInput.fromObject({
          source,
          "exportArn.$": "$.export.ExportDescription.ExportArn",
          "exportTime.$": "$$.Execution.StartTime",
        }),
        payloadResponseOnly: true,
        resultPath: "$.rebuildResult",
      });

      const check = new sfn.Choice(this, `ExportDone-${source}`)
        .when(sfn.Condition.stringEquals("$.export.ExportDescription.ExportStatus", "COMPLETED"), rebuild)
        .when(sfn.Condition.stringEquals("$.export.ExportDescription.ExportStatus", "FAILED"), exportFailed)
        .otherwise(wait);

      return startExport.next(wait).next(describe).next(check);
    });

    const rebuildAll = new sfn.Parallel(this, "RebuildAllSources").branch(...branches);

    const recomputeJobs = new tasks.LambdaInvoke(this, "RecomputeJobs", {
      lambdaFunction: props.jobRunnerLambda,
      payload: sfn.TaskInput.fromObject({}),
      payloadResponseOnly: true,
    });

    const logGroup = new logs.LogGroup(this, "LogGroup", {
      logGroupName: `/aws/vendedlogs/states/Nyc311WarehouseRebuild-${suffix}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    this.stateMachine = new sfn.StateMachine(this, "StateMachine", {
      stateMachineName: `Nyc311WarehouseRebuild-${suffix}`,
      definitionBody: sfn.DefinitionBody.fromChainable(rebuildAll.next(recomputeJobs)),
      timeout: Duration.hours(2),
      logs: { destination: logGroup, level: sfn.LogLevel.ALL },
    });

    /*
     * `dynamodb:ExportTableToPointInTime` (added by CallAwsService) writes
     * the export to S3 as this role — so it also needs S3 write on the
     * destination prefix + the bucket-level reads the export service does.
     */
    const bucketArn = props.warehouseBucket.bucket.bucketArn;
    this.stateMachine.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["s3:GetBucketLocation", "s3:ListBucketMultipartUploads"],
        resources: [bucketArn],
      })
    );
    this.stateMachine.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["s3:PutObject", "s3:AbortMultipartUpload"],
        resources: [`${bucketArn}/export-staging/*`],
      })
    );
  }
}
