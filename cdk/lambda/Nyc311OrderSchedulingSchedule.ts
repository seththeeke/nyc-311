import { Duration } from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as actions from "aws-cdk-lib/aws-cloudwatch-actions";
import { Schedule, ScheduleExpression } from "aws-cdk-lib/aws-scheduler";
import { LambdaInvoke } from "aws-cdk-lib/aws-scheduler-targets";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";
import type { Nyc311OrderSchedulingLambda } from "./Nyc311OrderSchedulingLambda";

export interface Nyc311OrderSchedulingScheduleProps {
  envName: Nyc311Environment;
  orderSchedulingLambda: Nyc311OrderSchedulingLambda;
  /** Where the repeated-failure CloudWatch Alarm notifies — same shape as Nyc311PollerSchedule. */
  failureNotificationEmail: string;
}

/* 6-order-scheduling.md §1 — the user's stated cadence, tighter than the poller's 6h since dispatch backlog is more time-sensitive. */
const SCHEDULE_INTERVAL = Duration.hours(1);

/* Same "one blip is a non-event, sustained is real" threshold as Nyc311PollerSchedule/Nyc311OrderPipelineAlarms. */
const CONSECUTIVE_FAILURES_TO_ALARM = 3;

/**
 * Wires the order-scheduling Lambda to its EventBridge Scheduler trigger
 * and failure handling (`6-order-scheduling.md` §1): a `Schedule` every
 * {@link SCHEDULE_INTERVAL}, a dead-letter queue on the Schedule's target,
 * and a CloudWatch Alarm on {@link CONSECUTIVE_FAILURES_TO_ALARM}
 * consecutive failures. Mirrors `Nyc311PollerSchedule` exactly.
 */
export class Nyc311OrderSchedulingSchedule extends Construct {
  public readonly schedule: Schedule;
  public readonly deadLetterQueue: sqs.Queue;
  public readonly failureAlarm: cloudwatch.Alarm;

  constructor(scope: Construct, id: string, props: Nyc311OrderSchedulingScheduleProps) {
    super(scope, id);

    const suffix = ENV_NAME_SUFFIX[props.envName];

    this.deadLetterQueue = new sqs.Queue(this, "Dlq", {
      queueName: `Nyc311OrderSchedulingDlq-${suffix}`,
      retentionPeriod: Duration.days(14),
      enforceSSL: true,
    });

    this.schedule = new Schedule(this, "Schedule", {
      scheduleName: `Nyc311OrderSchedulingSchedule-${suffix}`,
      schedule: ScheduleExpression.rate(SCHEDULE_INTERVAL),
      target: new LambdaInvoke(props.orderSchedulingLambda, {
        deadLetterQueue: this.deadLetterQueue,
      }),
    });

    const failureTopic = new sns.Topic(this, "FailureTopic", {
      topicName: `Nyc311OrderSchedulingFailures-${suffix}`,
    });
    failureTopic.addSubscription(new subscriptions.EmailSubscription(props.failureNotificationEmail));

    this.failureAlarm = new cloudwatch.Alarm(this, "FailureAlarm", {
      alarmName: `Nyc311OrderSchedulingFailureAlarm-${suffix}`,
      metric: props.orderSchedulingLambda.metricErrors({ period: SCHEDULE_INTERVAL, statistic: "sum" }),
      threshold: 1,
      evaluationPeriods: CONSECUTIVE_FAILURES_TO_ALARM,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    this.failureAlarm.addAlarmAction(new actions.SnsAction(failureTopic));
  }
}
