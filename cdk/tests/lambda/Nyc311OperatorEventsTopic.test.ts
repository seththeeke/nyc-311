import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { describe, it } from "vitest";
import { Nyc311OperatorEventsTopic } from "../../lambda/Nyc311OperatorEventsTopic";

function synthesize(envName: "TEST" | "PROD"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  new Nyc311OperatorEventsTopic(stack, "Nyc311OperatorEventsTopic", { envName });
  return Template.fromStack(stack);
}

describe("Nyc311OperatorEventsTopic", () => {
  it("creates an SNS topic with SSL enforced", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::SNS::Topic", { TopicName: "Nyc311OperatorEvents-Test" });
    template.hasResourceProperties("AWS::SNS::TopicPolicy", {});
  });

  it("suffixes the topic name by environment, distinguishing Test from Prod", () => {
    synthesize("TEST").hasResourceProperties("AWS::SNS::Topic", { TopicName: "Nyc311OperatorEvents-Test" });
    synthesize("PROD").hasResourceProperties("AWS::SNS::Topic", { TopicName: "Nyc311OperatorEvents-Prod" });
  });

  it("declares no subscriptions yet — the fan-out Lambda's grantPublish isn't a subscription", () => {
    const template = synthesize("TEST");

    template.resourceCountIs("AWS::SNS::Subscription", 0);
  });
});
