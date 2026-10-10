import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "aws-lambda";
import { dispatchWebhookEventController } from "../../../controller/webhook/dispatchWebhookEventController";
import { ValidationError } from "../../../models/errors";
import { dispatchWebhookEvent } from "../../../service/webhook/webhookDispatchService";
import { orderEvent } from "../../service/webhook/webhookTestFixtures";

vi.mock("../../../service/webhook/webhookDispatchService", () => ({ dispatchWebhookEvent: vi.fn() }));
const mockedDispatch = vi.mocked(dispatchWebhookEvent);
const fakeContext = { awsRequestId: "req-123" } as Context;
const accepted = orderEvent("ORDER_ACCEPTED", 1, "2026-10-10T14:03:11.000Z");

function record(messageId: string, body: unknown = accepted): unknown {
  return { messageId, body: typeof body === "string" ? body : JSON.stringify(body) };
}

beforeEach(() => {
  mockedDispatch.mockReset().mockResolvedValue(1);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("dispatchWebhookEventController", () => {
  it("parses each body as an OrderEvent and dispatches it", async () => {
    const response = await dispatchWebhookEventController({ Records: [record("1"), record("2")] }, fakeContext);
    expect(mockedDispatch).toHaveBeenCalledTimes(2);
    expect(mockedDispatch).toHaveBeenCalledWith(accepted);
    expect(response).toEqual({ batchItemFailures: [] });
  });

  it("reports only failed records, whatever they failed with", async () => {
    mockedDispatch.mockResolvedValueOnce(1).mockRejectedValueOnce(new Error("SQS throttled")).mockRejectedValueOnce("not an error");
    const event = { Records: [record("ok"), record("thrown"), record("string"), record("not-json", "{nope"), record("wrong-shape", { order_id: "x" })] };
    const response = await dispatchWebhookEventController(event, fakeContext);
    expect(response.batchItemFailures.map((failure) => failure.itemIdentifier)).toEqual(["thrown", "string", "not-json", "wrong-shape"]);
  });

  it("throws ValidationError for a malformed SQS event", async () => {
    await expect(dispatchWebhookEventController({ Records: "nope" }, fakeContext)).rejects.toBeInstanceOf(ValidationError);
  });
});
