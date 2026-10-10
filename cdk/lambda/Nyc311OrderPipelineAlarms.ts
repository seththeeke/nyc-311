import { Duration } from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as actions from "aws-cdk-lib/aws-cloudwatch-actions";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import { Construct } from "constructs";
import type { Nyc311OrdersStreamFanOutLambda } from "./Nyc311OrdersStreamFanOutLambda";
import type { Nyc311OrderEvaluationQueue } from "./Nyc311OrderEvaluationQueue";
import type { Nyc311LiveWorkspaceMetricsQueue } from "./Nyc311LiveWorkspaceMetricsQueue";
import type { Nyc311WebhookDeliveryQueue } from "./Nyc311WebhookDeliveryQueue";
import type { Nyc311WebhookDispatchQueue } from "./Nyc311WebhookDispatchQueue";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311OrderPipelineAlarmsProps {
  envName: Nyc311Environment;
  ordersStreamFanOutLambda: Nyc311OrdersStreamFanOutLambda;
  orderEvaluationQueue: Nyc311OrderEvaluationQueue;
  liveWorkspaceMetricsQueue: Nyc311LiveWorkspaceMetricsQueue;
  webhookDispatchQueue: Nyc311WebhookDispatchQueue;
  webhookDeliveryQueue: Nyc311WebhookDeliveryQueue;
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
 * `IteratorAge`, plus a DLQ-depth alarm per queue: evaluation, live
 * workspace metrics, and the two webhook queues
 * (`13-customer-simulation.md` §5). A DLQ message has already exhausted
 * its retries, so those alarm on the first one. One shared,
 * email-subscribed SNS topic for all six.
 */
export class Nyc311OrderPipelineAlarms extends Construct {
  public readonly errorsAlarm: cloudwatch.Alarm;
  public readonly iteratorAgeAlarm: cloudwatch.Alarm;
  public readonly dlqDepthAlarm: cloudwatch.Alarm;
  public readonly liveMetricsDlqDepthAlarm: cloudwatch.Alarm;
  public readonly webhookDispatchDlqDepthAlarm: cloudwatch.Alarm;
  public readonly webhookDeliveryDlqDepthAlarm: cloudwatch.Alarm;

  constructor(scope: Construct, id: string, props: Nyc311OrderPipelineAlarmsProps) {
    super(scope, id);

    const suffix = ENV_NAME_SUFFIX[props.envName];

    const failureTopic = new sns.Topic(this, "FailureTopic", {
      topicName: `Nyc311OrderPipelineFailures-${suffix}`,
    });
    failureTopic.addSubscription(new subscriptions.EmailSubscription(props.failureNotificationEmail));
    const notify = new actions.SnsAction(failureTopic);

    this.errorsAlarm = new cloudwatch.Alarm(this, "FanOutErrorsAlarm", {
      alarmName: `Nyc311OrdersStreamFanOutErrorsAlarm-${suffix}`,
      metric: props.ordersStreamFanOutLambda.metricErrors({ period: EVALUATION_PERIOD, statistic: "sum" }),
      threshold: 1,
      evaluationPeriods: CONSECUTIVE_PERIODS_TO_ALARM,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    this.errorsAlarm.addAlarmAction(notify);

    const iteratorAgeMetric = new cloudwatch.Metric({
      namespace: "AWS/Lambda",
      metricName: "IteratorAge",
      dimensionsMap: { FunctionName: props.ordersStreamFanOutLambda.functionName },
      period: EVALUATION_PERIOD,
      statistic: "Maximum",
    });
    this.iteratorAgeAlarm = new cloudwatch.Alarm(this, "FanOutIteratorAgeAlarm", {
      alarmName: `Nyc311OrdersStreamFanOutIteratorAgeAlarm-${suffix}`,
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

    /* A message here is an Order the live workspace tiles never counted — they stay short until it's redriven. */
    this.liveMetricsDlqDepthAlarm = new cloudwatch.Alarm(this, "LiveWorkspaceMetricsDlqDepthAlarm", {
      alarmName: `Nyc311LiveWorkspaceMetricsDlqDepthAlarm-${suffix}`,
      metric: props.liveWorkspaceMetricsQueue.deadLetterQueue.metricApproximateNumberOfMessagesVisible({
        period: Duration.minutes(5),
        statistic: "Maximum",
      }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    this.liveMetricsDlqDepthAlarm.addAlarmAction(notify);

    /* A message here is an accepted/resolved Order no webhook subscriber was told about. */
    this.webhookDispatchDlqDepthAlarm = new cloudwatch.Alarm(this, "WebhookDispatchDlqDepthAlarm", {
      alarmName: `Nyc311WebhookDispatchDlqDepthAlarm-${suffix}`,
      metric: props.webhookDispatchQueue.deadLetterQueue.metricApproximateNumberOfMessagesVisible({
        period: Duration.minutes(5),
        statistic: "Maximum",
      }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    this.webhookDispatchDlqDepthAlarm.addAlarmAction(notify);

    /* A message here is a delivery one subscriber refused for a full day of retries — redrive once it is healthy. */
    this.webhookDeliveryDlqDepthAlarm = new cloudwatch.Alarm(this, "WebhookDeliveryDlqDepthAlarm", {
      alarmName: `Nyc311WebhookDeliveryDlqDepthAlarm-${suffix}`,
      metric: props.webhookDeliveryQueue.deadLetterQueue.metricApproximateNumberOfMessagesVisible({
        period: Duration.minutes(5),
        statistic: "Maximum",
      }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    this.webhookDeliveryDlqDepthAlarm.addAlarmAction(notify);
  }
}
