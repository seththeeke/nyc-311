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
import type { Nyc311WarehouseJobRunnerLambda } from "./Nyc311WarehouseJobRunnerLambda";

export interface Nyc311WarehouseJobScheduleProps {
  envName: Nyc311Environment;
  jobRunnerLambda: Nyc311WarehouseJobRunnerLambda;
  /** Where the repeated-failure CloudWatch Alarm notifies — same shape as Nyc311OrderSchedulingSchedule. */
  failureNotificationEmail: string;
}

/* 7-data-warehousing.md §8 — the daily aggregation cadence. The runner's own retry-decision picks up a FAILED prior run on the next daily fire (§9). */
const SCHEDULE_INTERVAL = Duration.days(1);

/* One failed daily run is worth surfacing straight away — unlike the hourly jobs, there's no "one blip in many" here. */
const CONSECUTIVE_FAILURES_TO_ALARM = 1;

/**
 * Wires the warehouse job runner Lambda to its EventBridge Scheduler
 * trigger and failure handling (`7-data-warehousing.md` §8): a `Schedule`
 * every {@link SCHEDULE_INTERVAL}, a dead-letter queue on the Schedule's
 * target, and a CloudWatch Alarm on a failed run. Mirrors
 * `Nyc311OrderSchedulingSchedule`.
 */
export class Nyc311WarehouseJobSchedule extends Construct {
  public readonly schedule: Schedule;
  public readonly deadLetterQueue: sqs.Queue;
  public readonly failureAlarm: cloudwatch.Alarm;

  constructor(scope: Construct, id: string, props: Nyc311WarehouseJobScheduleProps) {
    super(scope, id);

    const suffix = ENV_NAME_SUFFIX[props.envName];

    this.deadLetterQueue = new sqs.Queue(this, "Dlq", {
      queueName: `Nyc311WarehouseJobDlq-${suffix}`,
      retentionPeriod: Duration.days(14),
      enforceSSL: true,
    });

    this.schedule = new Schedule(this, "Schedule", {
      scheduleName: `Nyc311WarehouseJobSchedule-${suffix}`,
      schedule: ScheduleExpression.rate(SCHEDULE_INTERVAL),
      target: new LambdaInvoke(props.jobRunnerLambda, {
        deadLetterQueue: this.deadLetterQueue,
      }),
    });

    const failureTopic = new sns.Topic(this, "FailureTopic", {
      topicName: `Nyc311WarehouseJobFailures-${suffix}`,
    });
    failureTopic.addSubscription(new subscriptions.EmailSubscription(props.failureNotificationEmail));

    this.failureAlarm = new cloudwatch.Alarm(this, "FailureAlarm", {
      alarmName: `Nyc311WarehouseJobFailureAlarm-${suffix}`,
      metric: props.jobRunnerLambda.metricErrors({ period: SCHEDULE_INTERVAL, statistic: "sum" }),
      threshold: 1,
      evaluationPeriods: CONSECUTIVE_FAILURES_TO_ALARM,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    this.failureAlarm.addAlarmAction(new actions.SnsAction(failureTopic));
  }
}
