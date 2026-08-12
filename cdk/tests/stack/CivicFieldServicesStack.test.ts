import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { CivicFieldServicesStack } from "../../stack/CivicFieldServicesStack";

// This stack is still a skeleton — no resources yet, so there's nothing for
// fine-grained `template.hasResourceProperties(...)` assertions (the norm
// per testing-framework.md §3) to check. Once real constructs land here,
// tests should shift to asserting on those; for now this just proves the
// stack synthesizes cleanly and the env-conditional tag takes each branch.

describe("CivicFieldServicesStack", () => {
  it("synthesizes and tags the stack for TEST", () => {
    const app = new App();
    const stack = new CivicFieldServicesStack(app, "TestStack", { envName: "TEST" });

    // Tags.of(...).add(...) applies via an Aspect, only visited during
    // synthesis — so synthesize (Template.fromStack triggers it) before
    // reading stack.tags back.
    expect(Template.fromStack(stack).toJSON()).toBeDefined();
    expect(stack.tags.tagValues()).toMatchObject({ Environment: "TEST" });
  });

  it("synthesizes and tags the stack for PROD", () => {
    const app = new App();
    const stack = new CivicFieldServicesStack(app, "ProdStack", { envName: "PROD" });

    expect(Template.fromStack(stack).toJSON()).toBeDefined();
    expect(stack.tags.tagValues()).toMatchObject({ Environment: "PROD" });
  });
});
