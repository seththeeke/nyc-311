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
import type { Nyc311PollerLambda } from "./Nyc311PollerLambda";

export interface Nyc311PollerScheduleProps {
  envName: Nyc311Environment;
  pollerLambda: Nyc311PollerLambda;
  /** Where the repeated-failure CloudWatch Alarm notifies — 1-data-ingestion.md §5. */
  failureNotificationEmail: string;
}

/*
 * 1-data-ingestion.md §3/§5 — "a few times a day," bounded so each window
 * (6-24h initial, safety-lagged thereafter) stays well inside the interval.
 */
const POLL_INTERVAL = Duration.hours(6);

/*
 * A single missed poll is a non-event (the cursor doesn't move, the next
 * run catches up) — 1-data-ingestion.md §5. Three consecutive failed
 * 6-hour runs (18h of no forward progress) is the "real signal worth
 * surfacing" threshold.
 */
const CONSECUTIVE_FAILURES_TO_ALARM = 3;

/**
 * Wires the poller Lambda to its EventBridge Scheduler trigger and failure
 * handling (1-data-ingestion.md §5): a `Schedule` every
 * {@link POLL_INTERVAL}, a dead-letter queue on the Schedule's target, and
 * a CloudWatch Alarm on {@link CONSECUTIVE_FAILURES_TO_ALARM} consecutive
 * failures.
 */
export class Nyc311PollerSchedule extends Construct {
  public readonly schedule: Schedule;
  public readonly deadLetterQueue: sqs.Queue;
  public readonly failureAlarm: cloudwatch.Alarm;

  constructor(scope: Construct, id: string, props: Nyc311PollerScheduleProps) {
    super(scope, id);

    const suffix = ENV_NAME_SUFFIX[props.envName];

    this.deadLetterQueue = new sqs.Queue(this, "Dlq", {
      queueName: `Nyc311PollerDlq-${suffix}`,
      retentionPeriod: Duration.days(14),
      enforceSSL: true,
    });

    this.schedule = new Schedule(this, "Schedule", {
      scheduleName: `Nyc311PollerSchedule-${suffix}`,
      schedule: ScheduleExpression.rate(POLL_INTERVAL),
      target: new LambdaInvoke(props.pollerLambda, {
        deadLetterQueue: this.deadLetterQueue,
      }),
    });

    const failureTopic = new sns.Topic(this, "FailureTopic", {
      topicName: `Nyc311PollerFailures-${suffix}`,
    });
    failureTopic.addSubscription(new subscriptions.EmailSubscription(props.failureNotificationEmail));

    this.failureAlarm = new cloudwatch.Alarm(this, "FailureAlarm", {
      alarmName: `Nyc311PollerFailureAlarm-${suffix}`,
      metric: props.pollerLambda.metricErrors({ period: POLL_INTERVAL, statistic: "sum" }),
      threshold: 1,
      evaluationPeriods: CONSECUTIVE_FAILURES_TO_ALARM,
      /*
       * Only alarm once every evaluation period saw a failure — an
       * isolated failed run followed by a healthy one shouldn't page
       * anyone, per §5's "one missed poll is a non-event."
       */
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    this.failureAlarm.addAlarmAction(new actions.SnsAction(failureTopic));
  }
}
