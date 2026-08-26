import { Duration } from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as actions from "aws-cdk-lib/aws-cloudwatch-actions";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import { Construct } from "constructs";
import type { Nyc311OrderEventFanOutLambda } from "./Nyc311OrderEventFanOutLambda";
import type { Nyc311OrderEvaluationQueue } from "./Nyc311OrderEvaluationQueue";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311OrderPipelineAlarmsProps {
  envName: Nyc311Environment;
  orderEventFanOutLambda: Nyc311OrderEventFanOutLambda;
  orderEvaluationQueue: Nyc311OrderEvaluationQueue;
  /** Where every alarm here notifies. */
  failureNotificationEmail: string;
}

/*
 * A stuck fan-out means Orders silently stop reaching evaluation, with no
 * other visible signal (5-order-evaluation.md §7) — 3 consecutive 15-minute
 * periods with at least one error, same "one blip is a non-event, sustained
 * is real" reasoning as the poller's own failure alarm.
 */
const EVALUATION_PERIOD = Duration.minutes(15);
const CONSECUTIVE_PERIODS_TO_ALARM = 3;

/** A stream that isn't being drained builds iterator age — 30 minutes is well past this pipeline's normal, near-instant processing latency. */
const ITERATOR_AGE_THRESHOLD_MS = Duration.minutes(30).toMilliseconds();

/**
 * CloudWatch Alarms for the order-evaluation pipeline
 * (`5-order-evaluation.md` §6/§7) — the fan-out Lambda's `Errors` and
 * `IteratorAge`, plus the evaluation queue's DLQ depth (any message there
 * is a genuine, already-exhausted-retries failure, worth alarming on
 * immediately, not after a sustained period). One shared, email-subscribed
 * SNS topic for all three, same pattern as `Nyc311PollerSchedule`'s own
 * dedicated failure topic.
 */
export class Nyc311OrderPipelineAlarms extends Construct {
  public readonly errorsAlarm: cloudwatch.Alarm;
  public readonly iteratorAgeAlarm: cloudwatch.Alarm;
  public readonly dlqDepthAlarm: cloudwatch.Alarm;

  constructor(scope: Construct, id: string, props: Nyc311OrderPipelineAlarmsProps) {
    super(scope, id);

    const suffix = ENV_NAME_SUFFIX[props.envName];

    const failureTopic = new sns.Topic(this, "FailureTopic", {
      topicName: `Nyc311OrderPipelineFailures-${suffix}`,
    });
    failureTopic.addSubscription(new subscriptions.EmailSubscription(props.failureNotificationEmail));
    const notify = new actions.SnsAction(failureTopic);

    this.errorsAlarm = new cloudwatch.Alarm(this, "FanOutErrorsAlarm", {
      alarmName: `Nyc311OrderEventFanOutErrorsAlarm-${suffix}`,
      metric: props.orderEventFanOutLambda.metricErrors({ period: EVALUATION_PERIOD, statistic: "sum" }),
      threshold: 1,
      evaluationPeriods: CONSECUTIVE_PERIODS_TO_ALARM,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    this.errorsAlarm.addAlarmAction(notify);

    const iteratorAgeMetric = new cloudwatch.Metric({
      namespace: "AWS/Lambda",
      metricName: "IteratorAge",
      dimensionsMap: { FunctionName: props.orderEventFanOutLambda.functionName },
      period: EVALUATION_PERIOD,
      statistic: "Maximum",
    });
    this.iteratorAgeAlarm = new cloudwatch.Alarm(this, "FanOutIteratorAgeAlarm", {
      alarmName: `Nyc311OrderEventFanOutIteratorAgeAlarm-${suffix}`,
      metric: iteratorAgeMetric,
      threshold: ITERATOR_AGE_THRESHOLD_MS,
      evaluationPeriods: CONSECUTIVE_PERIODS_TO_ALARM,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    this.iteratorAgeAlarm.addAlarmAction(notify);

    this.dlqDepthAlarm = new cloudwatch.Alarm(this, "EvaluationDlqDepthAlarm", {
      alarmName: `Nyc311OrderEvaluationDlqDepthAlarm-${suffix}`,
      metric: props.orderEvaluationQueue.deadLetterQueue.metricApproximateNumberOfMessagesVisible({
        period: Duration.minutes(5),
        statistic: "Maximum",
      }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    this.dlqDepthAlarm.addAlarmAction(notify);
  }
}
