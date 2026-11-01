import { Duration } from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as actions from "aws-cdk-lib/aws-cloudwatch-actions";
import * as logs from "aws-cdk-lib/aws-logs";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import { Construct } from "constructs";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface TeamChatAlarmsProps {
  envName: Nyc311Environment;
  apiLogGroup: logs.ILogGroup;
  notificationEmail: string;
}

const NAMESPACE = "Nyc311/TeamChat";

/**
 * Team Chat's alarms (docs/17-executive-team.md §10.5): any 429 (an agent
 * over its write cap, or the stage throttle) and any 5xx, read from the
 * router's `TeamChatApiRouterCompleted` log line.
 */
export class TeamChatAlarms extends Construct {
  public readonly rateLimitedAlarm: cloudwatch.Alarm;
  public readonly serverErrorAlarm: cloudwatch.Alarm;

  constructor(scope: Construct, id: string, props: TeamChatAlarmsProps) {
    super(scope, id);
    const suffix = ENV_NAME_SUFFIX[props.envName];
    const topic = new sns.Topic(this, "Topic", { topicName: `Nyc311TeamChatAlarms-${suffix}` });
    topic.addSubscription(new subscriptions.EmailSubscription(props.notificationEmail));

    const alarmOn = (name: string, pattern: string, description: string): cloudwatch.Alarm => {
      new logs.MetricFilter(this, `${name}Filter`, {
        logGroup: props.apiLogGroup,
        filterPattern: logs.FilterPattern.literal(pattern),
        metricNamespace: NAMESPACE,
        metricName: `${name}-${suffix}`,
        metricValue: "1",
        defaultValue: 0,
      });
      const alarm = new cloudwatch.Alarm(this, `${name}Alarm`, {
        alarmName: `Nyc311TeamChat${name}-${suffix}`,
        alarmDescription: description,
        metric: new cloudwatch.Metric({ namespace: NAMESPACE, metricName: `${name}-${suffix}`, statistic: "Sum", period: Duration.minutes(5) }),
        threshold: 1,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
      alarm.addAlarmAction(new actions.SnsAction(topic));
      return alarm;
    };

    this.rateLimitedAlarm = alarmOn("RateLimited", '{ $.message = "TeamChatApiRouterCompleted" && $.statusCode = 429 }', "A Team Chat caller hit its write cap or the stage throttle.");
    this.serverErrorAlarm = alarmOn("ServerErrors", '{ $.message = "TeamChatApiRouterCompleted" && $.statusCode >= 500 }', "The Team Chat API returned a 5xx.");
  }
}
