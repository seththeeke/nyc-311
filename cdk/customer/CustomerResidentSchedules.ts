import * as iam from "aws-cdk-lib/aws-iam";
import * as scheduler from "aws-cdk-lib/aws-scheduler";
import { Construct } from "constructs";
import { CUSTOMER_ENV_SUFFIX } from "./customerConfig";
import type { CustomerIdeaWorkerLambda } from "./CustomerIdeaWorkerLambda";
import type { ResidentSeedSummary } from "./residentSeedFiles";

export interface CustomerResidentSchedulesProps {
  ideaWorker: CustomerIdeaWorkerLambda;
  residents: ResidentSeedSummary[];
}

/* Spreads residents who share a cron across this window, so they do not all start in one minute (§3 Flow B decision 8). */
export const RESIDENT_SCHEDULE_WINDOW_MINUTES = 15;
/* A failed thought is tried twice more within the hour, then dropped; the next scheduled one comes soon enough. */
export const RESIDENT_SCHEDULE_RETRIES = 2;

/**
 * One EventBridge schedule per resident, on that resident's own cron in
 * New York time (§3 Flow B decision 6), each invoking the idea worker with
 * `{ persona_id }`. Disabling a schedule in the console stops that
 * resident; disabling all of them is the kill switch.
 */
export class CustomerResidentSchedules extends Construct {
  public readonly schedules: scheduler.CfnSchedule[];

  constructor(scope: Construct, id: string, props: CustomerResidentSchedulesProps) {
    super(scope, id);
    const role = new iam.Role(this, "Role", {
      roleName: `CustomerResidentScheduler-${CUSTOMER_ENV_SUFFIX}`,
      assumedBy: new iam.ServicePrincipal("scheduler.amazonaws.com"),
    });
    props.ideaWorker.grantInvoke(role);
    this.schedules = props.residents.map(
      (resident) =>
        new scheduler.CfnSchedule(this, `Schedule-${resident.personaId}`, {
          name: `CustomerResident-${resident.personaId}-${CUSTOMER_ENV_SUFFIX}`,
          description: `How often ${resident.personaId} thinks about ideas (13-customer-simulation.md §3 Flow B)`,
          scheduleExpression: resident.schedule,
          scheduleExpressionTimezone: "America/New_York",
          flexibleTimeWindow: { mode: "FLEXIBLE", maximumWindowInMinutes: RESIDENT_SCHEDULE_WINDOW_MINUTES },
          state: "ENABLED",
          target: {
            arn: props.ideaWorker.functionArn,
            roleArn: role.roleArn,
            input: JSON.stringify({ persona_id: resident.personaId }),
            retryPolicy: { maximumRetryAttempts: RESIDENT_SCHEDULE_RETRIES, maximumEventAgeInSeconds: 3600 },
          },
        })
    );
  }
}
