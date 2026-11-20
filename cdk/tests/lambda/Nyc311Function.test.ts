import { App, Duration, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { NYC311_BACKEND_ROOT, Nyc311Function, type Nyc311FunctionProps } from "../../lambda/Nyc311Function";

function synthesize(overrides: Partial<Nyc311FunctionProps> = {}): { template: Template; fn: Nyc311Function } {
  const stack = new Stack(new App(), "TestStack", { env: { region: "us-east-1" } });
  const fn = new Nyc311Function(stack, "Probe", {
    envName: "TEST",
    name: "Nyc311Probe",
    entry: ["controller", "ingestion", "nyc311PollerController.ts"],
    handler: "nyc311PollerController",
    timeout: Duration.seconds(15),
    memorySize: 384,
    environment: { SOME_VAR: "value" },
    ...overrides,
  });
  return { template: Template.fromStack(stack), fn };
}

describe("Nyc311Function", () => {
  it("names the function per environment and bundles on Node 22 with the given sizing and environment", () => {
    const { template } = synthesize();
    template.hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "Nyc311Probe-Test",
      Handler: "index.nyc311PollerController",
      Runtime: "nodejs22.x",
      Timeout: 15,
      MemorySize: 384,
      Environment: { Variables: { SOME_VAR: "value" } },
    });
    synthesize({ envName: "PROD" }).template.hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311Probe-Prod" });
  });

  it("leaves the name unsuffixed for a singleton-stack Lambda (envName null)", () => {
    const { template } = synthesize({ envName: null });
    template.hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311Probe" });
    template.hasResource("AWS::Logs::LogGroup", { Properties: { LogGroupName: "/aws/lambda/Nyc311Probe" }, DeletionPolicy: "Delete" });
  });

  it("owns a one-month log group that is destroyed with the stack", () => {
    const { template, fn } = synthesize();
    template.hasResource("AWS::Logs::LogGroup", {
      Properties: { LogGroupName: "/aws/lambda/Nyc311Probe-Test", RetentionInDays: 30 },
      DeletionPolicy: "Delete",
      UpdateReplacePolicy: "Delete",
    });
    template.hasResourceProperties("AWS::Lambda::Function", { LoggingConfig: { LogGroup: { Ref: Match.stringLikeRegexp("^ProbeLogGroup") } } });
    expect(fn.functionLogGroup.node.id).toBe("ProbeLogGroup");
  });

  it("leaves X-Ray tracing off unless a Lambda opts in", () => {
    synthesize().template.hasResourceProperties("AWS::Lambda::Function", { TracingConfig: Match.absent() });
    synthesize({ tracing: true }).template.hasResourceProperties("AWS::Lambda::Function", { TracingConfig: { Mode: "Active" } });
  });

  it("roots bundling at backend/", () => {
    expect(NYC311_BACKEND_ROOT.endsWith("/backend")).toBe(true);
  });
});
