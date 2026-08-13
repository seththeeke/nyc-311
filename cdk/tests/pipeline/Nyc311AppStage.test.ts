import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { Nyc311AppStage } from "../../pipeline/Nyc311AppStage";

describe("Nyc311AppStage", () => {
  it("names the wrapped stack Nyc311-Test for TEST", () => {
    const app = new App();
    const stage = new Nyc311AppStage(app, "DeployTest", { envName: "TEST" });
    const stack = stage.node.findChild("Nyc311Stack") as Stack;

    expect(stack.stackName).toBe("Nyc311-Test");
    expect(Template.fromStack(stack).toJSON()).toBeDefined();
    expect(stack.tags.tagValues()).toMatchObject({ Environment: "TEST" });
  });

  it("names the wrapped stack Nyc311-Prod for PROD", () => {
    const app = new App();
    const stage = new Nyc311AppStage(app, "DeployProd", { envName: "PROD" });
    const stack = stage.node.findChild("Nyc311Stack") as Stack;

    expect(stack.stackName).toBe("Nyc311-Prod");
    expect(Template.fromStack(stack).toJSON()).toBeDefined();
    expect(stack.tags.tagValues()).toMatchObject({ Environment: "PROD" });
  });
});
