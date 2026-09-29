import { App, CfnOutput, Stack } from "aws-cdk-lib";
import type { Construct } from "constructs";
import { describe, expect, it, vi } from "vitest";
import { Nyc311AppStage } from "../../pipeline/Nyc311AppStage";
import type { Nyc311StackProps } from "../../stack/Nyc311Stack";

/*
 * Nyc311AppStage only wraps Nyc311Stack in a Stage (per-env stack name,
 * output pass-through) — none of that logic touches a Lambda. The real
 * Nyc311Stack esbuild-bundles every Lambda in the app at construction time
 * (~5.5s each), which this file paid twice for behavior already covered
 * directly by tests/stack/Nyc311Stack.test.ts. Stub it so this file only
 * pays for what it actually tests.
 */
vi.mock("../../stack/Nyc311Stack", async () => {
  /* Dynamic import, not the module-top one — vi.mock factories are hoisted above imports, so the top-level `Stack`/`CfnOutput` bindings aren't initialized yet when this runs. */
  const { Stack: RealStack, CfnOutput: RealCfnOutput } = await import("aws-cdk-lib");

  class FakeNyc311Stack extends RealStack {
    public readonly apiUrlOutput: InstanceType<typeof RealCfnOutput>;
    public readonly adminUserPoolClientIdOutput: InstanceType<typeof RealCfnOutput>;

    constructor(scope: Construct, id: string, props: Nyc311StackProps) {
      super(scope, id, props);
      this.apiUrlOutput = new RealCfnOutput(this, "FakeApiUrl", { value: "fake-api-url" });
      this.adminUserPoolClientIdOutput = new RealCfnOutput(this, "FakeAdminUserPoolClientId", {
        value: "fake-admin-client-id",
      });
    }
  }
  return { Nyc311Stack: FakeNyc311Stack };
});

describe("Nyc311AppStage", () => {
  it("names the wrapped stack Nyc311-Test for TEST", () => {
    const app = new App();
    const stage = new Nyc311AppStage(app, "DeployTest", { envName: "TEST" });
    const stack = stage.node.findChild("Nyc311Stack") as Stack;

    expect(stack.stackName).toBe("Nyc311-Test");
  });

  it("names the wrapped stack Nyc311-Prod for PROD", () => {
    const app = new App();
    const stage = new Nyc311AppStage(app, "DeployProd", { envName: "PROD" });
    const stack = stage.node.findChild("Nyc311Stack") as Stack;

    expect(stack.stackName).toBe("Nyc311-Prod");
  });

  it("forwards the wrapped stack's apiUrlOutput and adminUserPoolClientIdOutput", () => {
    const app = new App();
    const stage = new Nyc311AppStage(app, "DeployTest", { envName: "TEST" });
    const stack = stage.node.findChild("Nyc311Stack") as unknown as {
      apiUrlOutput: CfnOutput;
      adminUserPoolClientIdOutput: CfnOutput;
    };

    expect(stage.apiUrlOutput).toBe(stack.apiUrlOutput);
    expect(stage.adminUserPoolClientIdOutput).toBe(stack.adminUserPoolClientIdOutput);
  });
});
