import { Duration, RemovalPolicy } from "aws-cdk-lib";
import * as logs from "aws-cdk-lib/aws-logs";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as tasks from "aws-cdk-lib/aws-stepfunctions-tasks";
import { Construct } from "constructs";
import type { IFunction } from "aws-cdk-lib/aws-lambda";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311OrderExecutionStateMachineProps {
  envName: Nyc311Environment;
  /** `Nyc311OrderExecutionLambda` — invoked once per phase. */
  executionLambda: IFunction;
}

/**
 * `Nyc311OrderExecutionStateMachine` (`10-capacity-modeling-and-integration.md`
 * §3.2/§3.8) — one execution per Order, started right after the
 * scheduling job claims an idle Operator:
 *
 * ```
 * Wait(scheduled_start_datetime) -> Dispatch -> Wait(transit)
 *   -> Arrive -> Wait(processing) -> Resolve
 * ```
 *
 * Dispatch fires only `ORDER_DISPATCHED` — `TRANSIT_STARTED` already
 * fired by the scheduling job (§3.6). Failure injection (§3.4) is
 * deferred — `Catch` just fails, Order stuck at `EXECUTE`.
 */
export class Nyc311OrderExecutionStateMachine extends Construct {
  public readonly stateMachine: sfn.StateMachine;

  constructor(scope: Construct, id: string, props: Nyc311OrderExecutionStateMachineProps) {
    super(scope, id);

    const suffix = ENV_NAME_SUFFIX[props.envName];

    const waitForScheduledStart = new sfn.Wait(this, "WaitForScheduledStart", {
      time: sfn.WaitTime.timestampPath("$.scheduled_start_datetime"),
    });

    /* No transit/processing minutes here — `dispatchOrder` re-estimates both live (Operator position for transit, processingTimeService for processing), each with its own random factor. */
    const dispatch = new tasks.LambdaInvoke(this, "Dispatch", {
      lambdaFunction: props.executionLambda,
      payload: sfn.TaskInput.fromObject({
        phase: "DISPATCH",
        "order_id.$": "$.order_id",
        "operator_id.$": "$.operator_id",
        "job_location.$": "$.job_location",
      }),
      payloadResponseOnly: true,
      resultPath: "$.dispatch",
    });

    const waitForTransit = new sfn.Wait(this, "WaitForTransit", {
      time: sfn.WaitTime.secondsPath("$.dispatch.transit_wait_seconds"),
    });

    const arrive = new tasks.LambdaInvoke(this, "Arrive", {
      lambdaFunction: props.executionLambda,
      payload: sfn.TaskInput.fromObject({
        phase: "ARRIVE",
        "order_id.$": "$.order_id",
        "operator_id.$": "$.operator_id",
        "job_location.$": "$.job_location",
      }),
      payloadResponseOnly: true,
      resultPath: "$.arrive",
    });

    const waitForProcessing = new sfn.Wait(this, "WaitForProcessing", {
      time: sfn.WaitTime.secondsPath("$.dispatch.processing_wait_seconds"),
    });

    const resolve = new tasks.LambdaInvoke(this, "Resolve", {
      lambdaFunction: props.executionLambda,
      payload: sfn.TaskInput.fromObject({
        phase: "RESOLVE",
        "order_id.$": "$.order_id",
        "operator_id.$": "$.operator_id",
        /* Drawn at Dispatch, stamped on ORDER_RESOLVED (v1-prod-deployment.md Q5). */
        "materials_cost_actual.$": "$.dispatch.materials_cost_actual",
      }),
      payloadResponseOnly: true,
      resultPath: "$.resolve",
    });

    const failed = new sfn.Fail(this, "ExecutionFailed");

    /*
     * v1-prod-deployment.md Q3/F6: any failed step routes here first —
     * vehicle back to IDLE, Order back to SCHEDULE — then the execution
     * still ends Failed so it's visible. LambdaInvoke's default
     * retryOnServiceExceptions already retries transient Lambda errors
     * before a Catch fires. If cleanup itself fails, end Failed anyway.
     */
    const handleFailure = new tasks.LambdaInvoke(this, "HandleFailure", {
      lambdaFunction: props.executionLambda,
      payload: sfn.TaskInput.fromObject({
        phase: "FAIL",
        "order_id.$": "$.order_id",
        "operator_id.$": "$.operator_id",
        "error.$": "$.executionError.Error",
      }),
      payloadResponseOnly: true,
      resultPath: "$.failure",
    });
    handleFailure.addCatch(failed, { resultPath: "$.cleanupError" });
    handleFailure.next(failed);

    const definition = waitForScheduledStart
      .next(dispatch)
      .next(waitForTransit)
      .next(arrive)
      .next(waitForProcessing)
      .next(resolve);

    for (const task of [dispatch, arrive, resolve]) {
      task.addCatch(handleFailure, { resultPath: "$.executionError" });
    }

    const logGroup = new logs.LogGroup(this, "LogGroup", {
      logGroupName: `/aws/vendedlogs/states/Nyc311OrderExecution-${suffix}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    this.stateMachine = new sfn.StateMachine(this, "StateMachine", {
      stateMachineName: `Nyc311OrderExecution-${suffix}`,
      definitionBody: sfn.DefinitionBody.fromChainable(definition),
      /* One Order's full transit + processing wait, plus headroom — real time at scale 1 (Prod) can be hours. */
      timeout: Duration.hours(12),
      logs: { destination: logGroup, level: sfn.LogLevel.ALL },
    });
  }
}
