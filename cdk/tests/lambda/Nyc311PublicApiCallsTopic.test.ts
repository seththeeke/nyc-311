import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { describe, it } from "vitest";
import { Nyc311PublicApiCallsTopic } from "../../lambda/Nyc311PublicApiCallsTopic";

function synthesize(envName: "TEST" | "PROD"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  new Nyc311PublicApiCallsTopic(stack, "Nyc311PublicApiCallsTopic", { envName });
  return Template.fromStack(stack);
}

describe("Nyc311PublicApiCallsTopic", () => {
  it("creates an SSL-enforced topic, suffixed by environment", () => {
    const test = synthesize("TEST");
    test.hasResourceProperties("AWS::SNS::Topic", { TopicName: "Nyc311PublicApiCalls-Test" });
    test.hasResourceProperties("AWS::SNS::TopicPolicy", {});
    synthesize("PROD").hasResourceProperties("AWS::SNS::Topic", { TopicName: "Nyc311PublicApiCalls-Prod" });
  });
});
