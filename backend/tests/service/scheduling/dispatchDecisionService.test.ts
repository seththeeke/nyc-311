import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DispatchDecisionSchema, type DispatchDecision } from "../../../models/dispatchDecision";
import { recordDispatchDecision } from "../../../service/scheduling/dispatchDecisionService";

const snsMock = mockClient(SNSClient);
const TOPIC = "arn:aws:sns:us-east-1:123456789012:Nyc311DispatchDecisions-Test";

const decision: DispatchDecision = {
  planner_run_id: "RUN-1",
  decided_at: "2026-11-27T12:22:00.000Z",
  dispatch_policy: "C",
  trigger: "SCHEDULE",
  model_version: null,
  decision_type: "ASSIGN",
  operator_id: "01OPERATOR",
  order_id: "01ORDER",
  considered_order_ids: JSON.stringify(["01ORDER", "02ORDER"]),
  considered_count: 2,
  order_age_rank: 1,
  location_is_fallback: false,
  distance_miles: 4.2,
  predicted_transit_minutes: 10.1,
  predicted_work_minutes: 30,
  edge_cost: null,
  wait_for_operator_id: null,
  expected_free_at: null,
  predicted_saving_minutes: null,
  recheck_at: null,
};

beforeEach(() => {
  snsMock.reset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.DISPATCH_DECISIONS_TOPIC_ARN;
});

describe("recordDispatchDecision", () => {
  it("publishes the decision row as JSON to the decisions topic", async () => {
    snsMock.on(PublishCommand).resolves({});

    await recordDispatchDecision(decision, { topicArn: TOPIC });

    const input = snsMock.commandCalls(PublishCommand)[0].args[0].input;
    expect(input.TopicArn).toBe(TOPIC);
    expect(DispatchDecisionSchema.parse(JSON.parse(String(input.Message)))).toEqual(decision);
  });

  it("reads the topic from DISPATCH_DECISIONS_TOPIC_ARN by default", async () => {
    process.env.DISPATCH_DECISIONS_TOPIC_ARN = TOPIC;
    snsMock.on(PublishCommand).resolves({});

    await recordDispatchDecision(decision);

    expect(snsMock.commandCalls(PublishCommand)[0].args[0].input.TopicArn).toBe(TOPIC);
  });

  it("never throws on a failed publish, logging a WARN instead", async () => {
    snsMock.on(PublishCommand).rejects(new Error("SNS down"));

    await expect(recordDispatchDecision(decision, { topicArn: TOPIC })).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("DispatchDecisionPublishFailed"));
  });

  it("never throws on a missing topic env var", async () => {
    await expect(recordDispatchDecision(decision)).resolves.toBeUndefined();
    expect(snsMock.commandCalls(PublishCommand)).toHaveLength(0);
  });

  it("logs non-Error failures too", async () => {
    const snsClient = { send: vi.fn().mockRejectedValue("plain string") } as unknown as SNSClient;

    await recordDispatchDecision(decision, { topicArn: TOPIC, snsClient });

    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("DispatchDecisionPublishFailed"));
  });

  it("refuses to publish an invalid row", async () => {
    await recordDispatchDecision({ ...decision, order_age_rank: 0 }, { topicArn: TOPIC });

    expect(snsMock.commandCalls(PublishCommand)).toHaveLength(0);
  });
});
