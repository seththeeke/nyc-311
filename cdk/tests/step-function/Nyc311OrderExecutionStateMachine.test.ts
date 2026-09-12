import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { OrdersTable } from "../../data/OrdersTable";
import { OperatorsTable } from "../../data/OperatorsTable";
import { Nyc311OrderExecutionLambda } from "../../lambda/Nyc311OrderExecutionLambda";
import { Nyc311OrderExecutionStateMachine } from "../../step-function/Nyc311OrderExecutionStateMachine";

function synthesize(envName: "TEST" | "PROD" = "TEST"): { template: Template; definition: string } {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  const ordersTable = new OrdersTable(stack, "OrdersTable", { envName });
  const operatorsTable = new OperatorsTable(stack, "OperatorsTable", { envName });
  const executionLambda = new Nyc311OrderExecutionLambda(stack, "Nyc311OrderExecutionLambda", {
    envName,
    ordersTable,
    operatorsTable,
    simulationTimeScale: 100,
  });
  new Nyc311OrderExecutionStateMachine(stack, "Nyc311OrderExecutionStateMachine", { envName, executionLambda });
  const template = Template.fromStack(stack);

  const stateMachines = template.findResources("AWS::StepFunctions::StateMachine");
  const [resource] = Object.values(stateMachines);
  const definitionString = (resource.Properties as { DefinitionString: { "Fn::Join": [string, unknown[]] } })
    .DefinitionString["Fn::Join"][1]
    .filter((part): part is string => typeof part === "string")
    .join("");

  return { template, definition: definitionString };
}

describe("Nyc311OrderExecutionStateMachine", () => {
  it("names the state machine per environment", () => {
    const { template } = synthesize("TEST");
    template.hasResourceProperties("AWS::StepFunctions::StateMachine", {
      StateMachineName: "Nyc311OrderExecution-Test",
    });

    const { template: prodTemplate } = synthesize("PROD");
    prodTemplate.hasResourceProperties("AWS::StepFunctions::StateMachine", {
      StateMachineName: "Nyc311OrderExecution-Prod",
    });
  });

  it("waits for scheduled_start_datetime before the first Lambda Task (§3.8's pre-scheduling hook)", () => {
    const { definition } = synthesize();

    expect(definition).toContain('"TimestampPath":"$.scheduled_start_datetime"');
  });

  it("invokes the execution Lambda exactly three times — Dispatch, Arrive, Resolve", () => {
    const { definition } = synthesize();

    expect((definition.match(/"Type":"Task"/g) ?? []).length).toBe(3);
  });

  it("passes phase DISPATCH, ARRIVE, RESOLVE to the three invocations, in order", () => {
    const { definition } = synthesize();

    expect(definition.indexOf('"phase":"DISPATCH"')).toBeGreaterThanOrEqual(0);
    expect(definition.indexOf('"phase":"ARRIVE"')).toBeGreaterThan(definition.indexOf('"phase":"DISPATCH"'));
    expect(definition.indexOf('"phase":"RESOLVE"')).toBeGreaterThan(definition.indexOf('"phase":"ARRIVE"'));
  });

  it("waits transit_wait_seconds from Dispatch's result before Arrive, and processing_wait_seconds before Resolve", () => {
    const { definition } = synthesize();

    expect(definition).toContain('"SecondsPath":"$.dispatch.transit_wait_seconds"');
    expect(definition).toContain('"SecondsPath":"$.dispatch.processing_wait_seconds"');
  });

  it("routes every Lambda Task's failure to a Fail state", () => {
    const { definition } = synthesize();

    expect((definition.match(/"ErrorEquals":\["States\.ALL"\]/g) ?? []).length).toBe(3);
    expect(definition).toContain('"Type":"Fail"');
  });

  it("sends state machine logs to a per-environment log group with ALL level", () => {
    const { template } = synthesize("TEST");

    template.hasResourceProperties("AWS::Logs::LogGroup", {
      LogGroupName: "/aws/vendedlogs/states/Nyc311OrderExecution-Test",
    });
    template.hasResourceProperties("AWS::StepFunctions::StateMachine", {
      LoggingConfiguration: Match.objectLike({ Level: "ALL" }),
    });
  });
});
