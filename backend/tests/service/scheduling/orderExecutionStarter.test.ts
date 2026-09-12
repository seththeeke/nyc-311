import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stepFunctionsOrderExecutionStarter } from "../../../service/scheduling/orderExecutionStarter";

const sfnMock = mockClient(SFNClient);

beforeEach(() => {
  sfnMock.reset();
  sfnMock.on(StartExecutionCommand).resolves({});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("stepFunctionsOrderExecutionStarter", () => {
  it("starts an execution named after the Order, carrying the full input", async () => {
    process.env.ORDER_EXECUTION_STATE_MACHINE_ARN = "arn:aws:states:us-east-1:123:stateMachine:Nyc311OrderExecution-Test";

    await stepFunctionsOrderExecutionStarter.startExecution({
      orderId: "01ORDER",
      operatorId: "01OPERATOR",
      jobLocation: { lat: 40.75, lng: -73.82 },
      transitMinutes: 20,
      processingMinutes: 30,
      scheduledStartDatetime: "2026-09-12T00:00:00.000Z",
    });

    const call = sfnMock.commandCalls(StartExecutionCommand)[0].args[0].input;
    expect(call.stateMachineArn).toBe("arn:aws:states:us-east-1:123:stateMachine:Nyc311OrderExecution-Test");
    expect(call.name).toBe("01ORDER");
    expect(JSON.parse(call.input as string)).toEqual({
      order_id: "01ORDER",
      operator_id: "01OPERATOR",
      job_location: { lat: 40.75, lng: -73.82 },
      transit_minutes: 20,
      processing_minutes: 30,
      scheduled_start_datetime: "2026-09-12T00:00:00.000Z",
    });
  });

  it("throws when ORDER_EXECUTION_STATE_MACHINE_ARN isn't set", async () => {
    const previous = process.env.ORDER_EXECUTION_STATE_MACHINE_ARN;
    delete process.env.ORDER_EXECUTION_STATE_MACHINE_ARN;

    try {
      await expect(
        stepFunctionsOrderExecutionStarter.startExecution({
          orderId: "01ORDER",
          operatorId: "01OPERATOR",
          jobLocation: { lat: 40.75, lng: -73.82 },
          transitMinutes: 20,
          processingMinutes: 30,
          scheduledStartDatetime: "2026-09-12T00:00:00.000Z",
        })
      ).rejects.toThrow("Missing required environment variable: ORDER_EXECUTION_STATE_MACHINE_ARN");
    } finally {
      if (previous !== undefined) process.env.ORDER_EXECUTION_STATE_MACHINE_ARN = previous;
    }
  });
});
