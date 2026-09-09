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
  /** `Nyc311WarehouseRebuildWorker` — invoked once per phase/chunk. */
  rebuildLambda: IFunction;
  /** `Nyc311WarehouseJobRunnerLambda` — invoked once at the end so every job re-runs against the rebuilt data. */
  jobRunnerLambda: IFunction;
}

/** Poll cadence for `DescribeExport`. */
const EXPORT_POLL_INTERVAL = Duration.seconds(30);
/*
 * `Wait` before each replay chunk — this is where rate-limiting lives.
 * The worker replays ~3k rows per chunk with no proactive pacing;
 * `3s / chunk` holds each stream well under its throughput limit while
 * letting the whole backfill run as long as it needs.
 */
const CHUNK_PACE = Duration.seconds(3);

/**
 * `Nyc311WarehouseRebuild` (`7-data-warehousing.md` §10) — manually
 * triggered (`test-scripts/5-warehouse-rebuild.py`), never scheduled. Per
 * source, in parallel: PITR-export → poll to `COMPLETED` → wipe
 * `data/<table>/` → replay the export one small line-range chunk at a
 * time (`Map`, `maxConcurrency:1`, a `Wait` before each — this is the
 * rate-limit). Then the job runner re-runs. Live capture is never paused.
 */
export class Nyc311WarehouseRebuildStateMachine extends Construct {
  public readonly stateMachine: sfn.StateMachine;

  constructor(scope: Construct, id: string, props: Nyc311WarehouseRebuildStateMachineProps) {
    super(scope, id);

    const suffix = ENV_NAME_SUFFIX[props.envName];
    const startTime = sfn.JsonPath.stringAt("$$.Execution.StartTime");

    const sourceTables: { source: string; table: TableV2 }[] = [
      { source: "orders", table: props.ordersTable },
      { source: "requests", table: props.requestsTable },
      { source: "locations", table: props.locationsTable },
    ];

    /*
     * Sources run **serially**, not in parallel: the account's Lambda
     * concurrency quota is small, and 3 concurrent replay chains starved
     * the API/fan-out Lambdas (a `GET /data/jobs` 503'd mid-rebuild once).
     * One `ReplayChunk` at a time leaves the rest of the account alone.
     */
    let head: sfn.IChainable | undefined;
    let prevEnd: sfn.INextable | undefined;

    for (const { source, table } of sourceTables) {
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

      const exportFailed = new sfn.Fail(this, `ExportFailed-${source}`, {
        causePath: "$.export.ExportDescription.FailureMessage",
      });

      const wipe = new tasks.LambdaInvoke(this, `Wipe-${source}`, {
        lambdaFunction: props.rebuildLambda,
        payload: sfn.TaskInput.fromObject({
          phase: "wipe",
          source,
          "exportArn.$": "$.export.ExportDescription.ExportArn",
          startedAt: startTime,
        }),
        payloadResponseOnly: true,
        resultPath: "$.wipe",
      });

      const replayChunk = new tasks.LambdaInvoke(this, `ReplayChunk-${source}`, {
        lambdaFunction: props.rebuildLambda,
        /* Reads plain `$.chunk` / `$.exportTime` — the Map's itemSelector (below) shapes each iteration's input. */
        payload: sfn.TaskInput.fromObject({
          phase: "replay",
          source,
          "exportTime.$": "$.exportTime",
          "chunk.$": "$.chunk",
        }),
        payloadResponseOnly: true,
      });

      const replayMap = new sfn.Map(this, `ReplayChunks-${source}`, {
        itemsPath: "$.wipe.chunks",
        maxConcurrency: 1,
        resultPath: "$.replayResults",
        /*
         * `$$.Map.Item.Value` is only reliably resolvable here at the Map
         * boundary, not deep in a nested `Wait → Task` processor — so
         * capture the chunk + execution start time into each iteration's
         * input.
         */
        itemSelector: {
          "chunk.$": "$$.Map.Item.Value",
          "exportTime.$": "$$.Execution.StartTime",
        },
      });
      replayMap.itemProcessor(
        new sfn.Wait(this, `PaceChunk-${source}`, { time: sfn.WaitTime.duration(CHUNK_PACE) }).next(replayChunk)
      );

      const finalize = new tasks.LambdaInvoke(this, `Finalize-${source}`, {
        lambdaFunction: props.rebuildLambda,
        payload: sfn.TaskInput.fromObject({
          phase: "finalize",
          source,
          "exportArn.$": "$.export.ExportDescription.ExportArn",
          "jobRunId.$": "$.wipe.job_run_id",
          startedAt: startTime,
          "replayResults.$": "$.replayResults",
        }),
        payloadResponseOnly: true,
      });

      const markFailed = new tasks.LambdaInvoke(this, `MarkFailed-${source}`, {
        lambdaFunction: props.rebuildLambda,
        payload: sfn.TaskInput.fromObject({
          phase: "fail",
          source,
          "exportArn.$": "$.export.ExportDescription.ExportArn",
          "jobRunId.$": "$.wipe.job_run_id",
          startedAt: startTime,
          "error.$": "$.rebuildError.Cause",
        }),
        payloadResponseOnly: true,
      }).next(new sfn.Fail(this, `RebuildFailed-${source}`));

      /* A wipe/replay/finalize failure closes the RUNNING job row as FAILED, then fails the branch. */
      replayMap.addCatch(markFailed, { resultPath: "$.rebuildError" });
      finalize.addCatch(markFailed, { resultPath: "$.rebuildError" });

      /* wipe → replayMap → finalize; the Choice below routes a COMPLETED export into `wipe`. */
      wipe.next(replayMap).next(finalize);

      const check = new sfn.Choice(this, `ExportDone-${source}`)
        .when(sfn.Condition.stringEquals("$.export.ExportDescription.ExportStatus", "COMPLETED"), wipe)
        .when(sfn.Condition.stringEquals("$.export.ExportDescription.ExportStatus", "FAILED"), exportFailed)
        .otherwise(wait);

      startExport.next(wait).next(describe).next(check);

      if (!head) head = startExport;
      if (prevEnd) prevEnd.next(startExport);
      prevEnd = finalize;
    }

    const recomputeJobs = new tasks.LambdaInvoke(this, "RecomputeJobs", {
      lambdaFunction: props.jobRunnerLambda,
      payload: sfn.TaskInput.fromObject({}),
      payloadResponseOnly: true,
    });
    (prevEnd as sfn.INextable).next(recomputeJobs);

    const logGroup = new logs.LogGroup(this, "LogGroup", {
      logGroupName: `/aws/vendedlogs/states/Nyc311WarehouseRebuild-${suffix}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    this.stateMachine = new sfn.StateMachine(this, "StateMachine", {
      stateMachineName: `Nyc311WarehouseRebuild-${suffix}`,
      definitionBody: sfn.DefinitionBody.fromChainable(head as sfn.IChainable),
      timeout: Duration.hours(6),
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
