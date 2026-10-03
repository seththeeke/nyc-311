import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { describe, it } from "vitest";
import { Nyc311CostBudget } from "../../stack/Nyc311CostBudget";

function synthesize(): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  new Nyc311CostBudget(stack, "Nyc311CostBudget", { monthlyLimitUsd: 20, notificationEmail: "ops@example.com" });
  return Template.fromStack(stack);
}

function notification(notificationType: string, threshold: number) {
  return {
    Notification: {
      NotificationType: notificationType,
      ComparisonOperator: "GREATER_THAN",
      Threshold: threshold,
      ThresholdType: "PERCENTAGE",
    },
    Subscribers: [{ SubscriptionType: "EMAIL", Address: "ops@example.com" }],
  };
}

describe("Nyc311CostBudget", () => {
  it("declares a monthly USD cost budget at the given limit", () => {
    synthesize().hasResourceProperties("AWS::Budgets::Budget", {
      Budget: {
        BudgetName: "Nyc311MonthlyCost",
        BudgetType: "COST",
        TimeUnit: "MONTHLY",
        BudgetLimit: { Amount: 20, Unit: "USD" },
      },
    });
  });

  it("emails on actual spend at 80% and 100%, and forecasted spend at 100%", () => {
    synthesize().hasResourceProperties("AWS::Budgets::Budget", {
      NotificationsWithSubscribers: [
        notification("ACTUAL", 80),
        notification("ACTUAL", 100),
        notification("FORECASTED", 100),
      ],
    });
  });
});
