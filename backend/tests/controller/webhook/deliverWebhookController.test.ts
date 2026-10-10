import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "aws-lambda";
import { deliverWebhookController } from "../../../controller/webhook/deliverWebhookController";
import { ValidationError } from "../../../models/errors";
import { deliverWebhook } from "../../../service/webhook/webhookDeliveryService";
import { webhookEvent } from "../../service/webhook/webhookTestFixtures";

vi.mock("../../../service/webhook/webhookDeliveryService", () => ({ deliverWebhook: vi.fn() }));
const mockedDeliver = vi.mocked(deliverWebhook);
const fakeContext = { awsRequestId: "req-123" } as Context;
const task = { webhook_id: "evt_01ORDER_1", subscription_id: "01SUB", event: webhookEvent };

function record(messageId: string, body: unknown = task, attributes?: Record<string, string>): unknown {
  return { messageId, body: typeof body === "string" ? body : JSON.stringify(body), ...(attributes ? { attributes } : {}) };
}

beforeEach(() => {
  mockedDeliver.mockReset().mockResolvedValue("DELIVERED");
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("deliverWebhookController", () => {
  it("delivers each task with SQS's receive count as the attempt number", async () => {
    const event = { Records: [record("1", task, { ApproximateReceiveCount: "7" }), record("2")] };
    const response = await deliverWebhookController(event, fakeContext);
    expect(mockedDeliver).toHaveBeenNthCalledWith(1, task, 7);
    expect(mockedDeliver).toHaveBeenNthCalledWith(2, task, 1);
    expect(response).toEqual({ batchItemFailures: [] });
  });

  it("leaves a failed delivery on the queue by reporting it, whatever it failed with", async () => {
    mockedDeliver.mockRejectedValueOnce(new Error("returned 503")).mockRejectedValueOnce("not an error").mockResolvedValueOnce("DROPPED");
    const event = { Records: [record("failed"), record("string"), record("dropped"), record("not-json", "{nope"), record("wrong-shape", { webhook_id: "x" })] };
    const response = await deliverWebhookController(event, fakeContext);
    expect(response.batchItemFailures.map((failure) => failure.itemIdentifier)).toEqual(["failed", "string", "not-json", "wrong-shape"]);
  });

  it("throws ValidationError for a malformed SQS event", async () => {
    await expect(deliverWebhookController({}, fakeContext)).rejects.toBeInstanceOf(ValidationError);
  });
});
