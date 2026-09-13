import { Duration, RemovalPolicy } from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as actions from "aws-cdk-lib/aws-cloudwatch-actions";
import * as iam from "aws-cdk-lib/aws-iam";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { CfnScheduleGroup } from "aws-cdk-lib/aws-scheduler";
import { Construct } from "constructs";
import type { Nyc311WarehouseJobRunnerLambda } from "./Nyc311WarehouseJobRunnerLambda";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311WarehouseJobScheduleGroupProps {
  envName: Nyc311Environment;
  jobRunnerLambda: Nyc311WarehouseJobRunnerLambda;
  /** Where the repeated-failure CloudWatch Alarm notifies — same shape as Nyc311OrderSchedulingSchedule. */
  failureNotificationEmail: string;
}

/* A daily-equivalent evaluation window — jobs run on varied cadences now (Leg 8), so this is a simplification, not a per-job SLA. */
const ALARM_PERIOD = Duration.days(1);
const CONSECUTIVE_FAILURES_TO_ALARM = 1;

/**
 * Shared infrastructure every self-service job's schedule references
 * (`7-data-warehousing.md` §8, Leg 8): a schedule group, an IAM role
 * schedules assume to invoke the job runner, a shared DLQ, and the
 * runner's aggregate `Errors` alarm. Individual job schedules are
 * created/deleted at runtime by `warehouseJobDefinitionService.ts`, not
 * declared here — job identities don't exist at synth time.
 */
export class Nyc311WarehouseJobScheduleGroup extends Construct {
  public readonly scheduleGroup: CfnScheduleGroup;
  /** The plain string passed to `scheduleGroup`'s `name` prop — read this, not `scheduleGroup.name` (typed optional even though it's always set here). */
  public readonly scheduleGroupName: string;
  public readonly invocationRole: iam.Role;
  public readonly deadLetterQueue: sqs.Queue;
  public readonly failureAlarm: cloudwatch.Alarm;

  constructor(scope: Construct, id: string, props: Nyc311WarehouseJobScheduleGroupProps) {
    super(scope, id);

    const suffix = ENV_NAME_SUFFIX[props.envName];

    this.scheduleGroupName = `Nyc311WarehouseJobs-${suffix}`;
    this.scheduleGroup = new CfnScheduleGroup(this, "Group", {
      name: this.scheduleGroupName,
    });

    /*
     * Trusted by scheduler.amazonaws.com only, and can invoke exactly
     * one function — a schedule created through the admin API can't be
     * pointed at any other resource, no matter how it's abused.
     */
    this.invocationRole = new iam.Role(this, "InvocationRole", {
      roleName: `Nyc311WarehouseJobScheduleRole-${suffix}`,
      assumedBy: new iam.ServicePrincipal("scheduler.amazonaws.com"),
    });
    this.invocationRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["lambda:InvokeFunction"],
        resources: [props.jobRunnerLambda.functionArn],
      })
    );

    this.deadLetterQueue = new sqs.Queue(this, "Dlq", {
      queueName: `Nyc311WarehouseJobDlq-${suffix}`,
      retentionPeriod: Duration.days(14),
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const failureTopic = new sns.Topic(this, "FailureTopic", {
      topicName: `Nyc311WarehouseJobFailures-${suffix}`,
    });
    failureTopic.addSubscription(new subscriptions.EmailSubscription(props.failureNotificationEmail));

    this.failureAlarm = new cloudwatch.Alarm(this, "FailureAlarm", {
      alarmName: `Nyc311WarehouseJobFailureAlarm-${suffix}`,
      metric: props.jobRunnerLambda.metricErrors({ period: ALARM_PERIOD, statistic: "sum" }),
      threshold: 1,
      evaluationPeriods: CONSECUTIVE_FAILURES_TO_ALARM,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    this.failureAlarm.addAlarmAction(new actions.SnsAction(failureTopic));
  }
}
