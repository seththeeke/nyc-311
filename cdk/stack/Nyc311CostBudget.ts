import { CfnBudget } from "aws-cdk-lib/aws-budgets";
import type { Construct } from "constructs";

export interface Nyc311CostBudgetProps {
  /** Monthly limit in USD — v1-prod-deployment.md Q8 set it at $20. */
  monthlyLimitUsd: number;
  notificationEmail: string;
}

/* Actual spend at 80% and 100%, plus forecasted spend at 100% (Q8). */
const NOTIFICATIONS: { notificationType: "ACTUAL" | "FORECASTED"; threshold: number }[] = [
  { notificationType: "ACTUAL", threshold: 80 },
  { notificationType: "ACTUAL", threshold: 100 },
  { notificationType: "FORECASTED", threshold: 100 },
];

/**
 * A monthly AWS cost budget with email alerts (v1-prod-deployment.md B2).
 * A budget covers the whole account, not one stack, so Nyc311Stack creates
 * this for Prod only; it catches Test, pipeline, and CodeBuild spend too.
 * Budget emails need no subscription confirmation, unlike SNS.
 */
export class Nyc311CostBudget extends CfnBudget {
  constructor(scope: Construct, id: string, props: Nyc311CostBudgetProps) {
    super(scope, id, {
      budget: {
        budgetName: "Nyc311MonthlyCost",
        budgetType: "COST",
        timeUnit: "MONTHLY",
        budgetLimit: { amount: props.monthlyLimitUsd, unit: "USD" },
      },
      notificationsWithSubscribers: NOTIFICATIONS.map(({ notificationType, threshold }) => ({
        notification: {
          notificationType,
          comparisonOperator: "GREATER_THAN",
          threshold,
          thresholdType: "PERCENTAGE",
        },
        subscribers: [{ subscriptionType: "EMAIL", address: props.notificationEmail }],
      })),
    });
  }
}
