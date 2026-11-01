import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicApiCall } from "../../../models/publicApi/publicApiCall";
import { PublicApiCallSchema } from "../../../models/publicApi/publicApiCall";
import { recordPublicApiCall } from "../../../service/publicApi/publicApiUsageService";

const snsMock = mockClient(SNSClient);
const TOPIC = "arn:aws:sns:us-east-1:123456789012:Nyc311PublicApiCalls-Test";

const call: PublicApiCall = {
  call_id: "01K8D2ZZZZZZZZZZZZZZZZZZZZ",
  requester: "resident:hawthorn",
  operation: "SEARCH_REQUESTS",
  route_key: "POST /v1/requests/search",
  status_code: 200,
  outcome: "SUCCESS",
  latency_ms: 84,
  request_params: "order_id=01K7XWQ2B9N4M8F3T6RZ0Y5DKA",
  result_count: 1,
  resource_id: null,
  occurred_at: "2026-11-02T22:14:00.000Z",
};

beforeEach(() => {
  snsMock.reset();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("recordPublicApiCall", () => {
  it("publishes the call row as JSON to the usage topic", async () => {
    snsMock.on(PublishCommand).resolves({});
    await recordPublicApiCall(call, { topicArn: TOPIC });
    const input = snsMock.commandCalls(PublishCommand)[0].args[0].input;
    expect(input.TopicArn).toBe(TOPIC);
    expect(PublicApiCallSchema.parse(JSON.parse(String(input.Message)))).toEqual(call);
  });

  it("reads the topic from PUBLIC_API_CALLS_TOPIC_ARN", async () => {
    snsMock.on(PublishCommand).resolves({});
    process.env.PUBLIC_API_CALLS_TOPIC_ARN = TOPIC;
    try {
      await recordPublicApiCall(call, { snsClient: new SNSClient({}) });
    } finally {
      delete process.env.PUBLIC_API_CALLS_TOPIC_ARN;
    }
    expect(snsMock.commandCalls(PublishCommand)[0].args[0].input.TopicArn).toBe(TOPIC);
  });

  it("throws when the publish fails, for the router to absorb", async () => {
    snsMock.on(PublishCommand).rejects(new Error("throttled"));
    await expect(recordPublicApiCall(call, { topicArn: TOPIC })).rejects.toThrow("throttled");
  });
});
