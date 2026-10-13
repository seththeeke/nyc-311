import { App, Stack } from "aws-cdk-lib";
import { describe, expect, it } from "vitest";
import { Nyc311CustomerStage } from "../../pipeline/Nyc311CustomerStage";

describe("Nyc311CustomerStage", () => {
  it("wraps exactly one stack, named Nyc311Customer-Prod, in the stage's own environment", () => {
    const app = new App();
    const stage = new Nyc311CustomerStage(app, "DeployCustomer", { env: { account: "123456789012", region: "us-east-1" } });
    const stacks = stage.node.children.filter((child): child is Stack => child instanceof Stack);

    expect(stacks).toHaveLength(1);
    expect(stacks[0].stackName).toBe("Nyc311Customer-Prod");
    expect(stacks[0].region).toBe("us-east-1");
    expect(stacks[0].account).toBe("123456789012");
  });
});
