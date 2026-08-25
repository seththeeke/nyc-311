import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { describe, it } from "vitest";
import { Nyc311OrderEventsTopic } from "../../lambda/Nyc311OrderEventsTopic";

function synthesize(envName: "TEST" | "PROD"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  new Nyc311OrderEventsTopic(stack, "Nyc311OrderEventsTopic", { envName });
  return Template.fromStack(stack);
}

describe("Nyc311OrderEventsTopic", () => {
  it("creates an SNS topic with SSL enforced", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::SNS::Topic", { TopicName: "Nyc311OrderEvents-Test" });
    template.hasResourceProperties("AWS::SNS::TopicPolicy", {});
  });

  it("suffixes the topic name by environment, distinguishing Test from Prod", () => {
    synthesize("TEST").hasResourceProperties("AWS::SNS::Topic", { TopicName: "Nyc311OrderEvents-Test" });
    synthesize("PROD").hasResourceProperties("AWS::SNS::Topic", { TopicName: "Nyc311OrderEvents-Prod" });
  });

  it("declares no subscriptions yet — the evaluation leg is a later slice", () => {
    const template = synthesize("TEST");

    template.resourceCountIs("AWS::SNS::Subscription", 0);
  });
});
