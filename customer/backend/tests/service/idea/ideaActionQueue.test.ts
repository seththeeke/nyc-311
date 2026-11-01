import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enqueueIdeaAction } from "../../../service/idea/ideaActionQueue";

const sqsMock = mockClient(SQSClient);

beforeEach(() => {
  sqsMock.reset();
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("enqueueIdeaAction", () => {
  it("sends the idea's ids to the IdeaActions queue", async () => {
    sqsMock.on(SendMessageCommand).resolves({});
    await enqueueIdeaAction({ persona_id: "hawthorn", idea_id: "01X" }, { client: new SQSClient({}), queueUrl: "https://sqs/q" });
    expect(sqsMock.commandCalls(SendMessageCommand)[0].args[0].input).toEqual({ QueueUrl: "https://sqs/q", MessageBody: '{"persona_id":"hawthorn","idea_id":"01X"}' });
  });

  it("reads the queue URL from IDEA_ACTIONS_QUEUE_URL", async () => {
    sqsMock.on(SendMessageCommand).resolves({});
    vi.stubEnv("IDEA_ACTIONS_QUEUE_URL", "https://sqs/env");
    await enqueueIdeaAction({ persona_id: "hawthorn", idea_id: "01X" });
    expect(sqsMock.commandCalls(SendMessageCommand)[0].args[0].input.QueueUrl).toBe("https://sqs/env");
  });
});
