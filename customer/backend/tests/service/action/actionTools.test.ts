import { describe, expect, it, vi } from "vitest";
import type { ResidentFeatureRequestThread } from "../../../models/residentIdea";
import { ACTION_TOOLS, MAX_STORED_BODY_CHARS, truncateBody, type ToolContext } from "../../../service/action/actionTools";
import type { PublicApiReply } from "../../../service/action/publicApiClient";
import { current, featureIdea, idea } from "../../residentFixtures";

const NOW = new Date("2026-11-02T22:14:01.000Z");
const FR_ID = "01K8C4T1W7H3P9N2M6QZ8V0RJD";
const filed: ResidentFeatureRequestThread = {
  persona_id: "hawthorn",
  sk: `FEATURE_REQUEST#${FR_ID}`,
  feature_request_id: FR_ID,
  title: "Texts please",
  filed_by_idea_id: idea.idea_id,
  last_known_status: "RECEIVED",
  last_known_status_reason: null,
  last_checked_at: "2026-11-01T00:00:00.000Z",
  created_at: "2026-11-01T00:00:00.000Z",
};

function context(overrides: Partial<ToolContext> = {}, replyWith?: PublicApiReply | Error): ToolContext & { call: ReturnType<typeof vi.fn> } {
  const call = vi.fn();
  if (replyWith instanceof Error) call.mockRejectedValue(replyWith);
  else if (replyWith) call.mockResolvedValue(replyWith);
  return { resident: current, idea, featureRequests: [filed], sequence: 2, now: () => NOW, call, ...overrides } as ToolContext & { call: ReturnType<typeof vi.fn> };
}

const search = ACTION_TOOLS.SEARCH_REQUESTS!;
const create = ACTION_TOOLS.CREATE_FEATURE_REQUEST!;
const get = ACTION_TOOLS.GET_FEATURE_REQUEST!;

describe("SEARCH_REQUESTS", () => {
  it("is offered only for an idea about an order, and takes no input", () => {
    expect(search.runnable(context())).toBe(true);
    expect(search.runnable(context({ idea: featureIdea }))).toBe(false);
    expect(search.inputSchema(context())).toEqual({ type: "object", properties: {} });
  });

  it("searches the idea's own order as the resident, and remembers what it saw", async () => {
    const item = { order_id: "01ORDER", status: "SCHEDULED", status_reason_description: null, scheduled_window: { start: "S", end: "E" }, status_updated_at: "U" };
    const ctx = context({}, { status_code: 200, call_id: "01CALL", body: { items: [item], next_cursor: null } });
    const outcome = await search.run(ctx, { order_id: "SOMETHING_ELSE" });
    expect(ctx.call).toHaveBeenCalledWith({
      method: "POST",
      path: "/v1/requests/search",
      body: { search_params: { order_id: "01ORDER" } },
      headers: { "X-Requester": "resident:hawthorn" },
    });
    expect(outcome.execution).toMatchObject({ status: "COMPLETED", summary: "Found it: scheduled, scheduled S to E.", response: { status_code: 200, call_id: "01CALL" }, error: null });
    expect(outcome.threadWrites).toEqual([{ kind: "ORDER_CHECKED", order_id: "01ORDER", status: "SCHEDULED", scheduled_window: { start: "S", end: "E" }, at: NOW.toISOString() }]);
  });

  it("explains an empty result and a not-serviced reason", async () => {
    const empty = await search.run(context({}, { status_code: 200, call_id: null, body: { items: [], next_cursor: null } }), {});
    expect(empty.execution.summary).toBe("BoroughSim has no request for order 01ORDER.");
    expect(empty.threadWrites).toEqual([]);
    const item = { order_id: "01ORDER", status: "NOT_SERVICED", status_reason_description: "Not serviced.", scheduled_window: null, status_updated_at: "U" };
    const refused = await search.run(context({}, { status_code: 200, call_id: null, body: { items: [item], next_cursor: null } }), {});
    expect(refused.execution.summary).toBe("Found it: not serviced (Not serviced.).");
  });

  it("records an HTTP error with BoroughSim's code, or a network failure, as FAILED", async () => {
    const http = await search.run(context({}, { status_code: 400, call_id: "C", body: { error: { code: "VALIDATION_ERROR", message: "bad" } } }), {});
    expect(http.execution).toMatchObject({ status: "FAILED", summary: "BoroughSim answered 400 VALIDATION_ERROR: bad", error: "BoroughSim answered 400 VALIDATION_ERROR: bad" });
    const throttled = await search.run(context({}, { status_code: 429, call_id: null, body: "Too Many Requests" }), {});
    expect(throttled.execution.summary).toBe("BoroughSim answered 429");
    const down = await search.run(context({}, new Error("timeout")), {});
    expect(down.execution).toMatchObject({ status: "FAILED", summary: "Couldn't reach BoroughSim: timeout", response: null });
    const call = vi.fn().mockRejectedValue("weird");
    const odd = await search.run({ ...context(), call }, {});
    expect(odd.execution).toMatchObject({ status: "FAILED", summary: "Couldn't reach BoroughSim: weird" });
  });
});

describe("CREATE_FEATURE_REQUEST", () => {
  const filedReply: PublicApiReply = {
    status_code: 201,
    call_id: "01CALL",
    body: { feature_request_id: FR_ID, status: "RECEIVED", status_reason_description: null, title: "Text me when work is booked" },
  };

  it("files in the resident's words under their name, with an idempotency key from the idea and step", async () => {
    const ctx = context({}, filedReply);
    const outcome = await create.run(ctx, { title: "  Text me when work is booked ", description: "I want a text when my street is booked." });
    expect(ctx.call).toHaveBeenCalledWith({
      method: "POST",
      path: "/v1/feature-requests",
      body: { title: "Text me when work is booked", description: "I want a text when my street is booked.", submitted_by: { name: "Hawthorn", email: null } },
      headers: { "X-Requester": "resident:hawthorn", "Idempotency-Key": `${idea.idea_id}-2` },
    });
    expect(outcome.execution.summary).toBe(`Filed feature request ${FR_ID}: "Text me when work is booked" (received).`);
    expect(outcome.threadWrites).toEqual([
      { kind: "FEATURE_REQUEST_FILED", feature_request_id: FR_ID, title: "Text me when work is booked", idea_id: idea.idea_id, status: "RECEIVED", status_reason: null, at: NOW.toISOString() },
    ]);
    expect(create.runnable(ctx)).toBe(true);
    expect(create.inputSchema(ctx)).toMatchObject({ required: ["title", "description"] });
  });

  it("checks the draft before calling, and records BoroughSim's refusal", async () => {
    const ctx = context({}, filedReply);
    const outcome = await create.run(ctx, { title: "Hi", description: "short" });
    expect(ctx.call).not.toHaveBeenCalled();
    expect(outcome.execution).toMatchObject({ status: "FAILED", request: null, response: null });
    expect(outcome.execution.summary).toContain("Not filed: title");
    const refused = await create.run(context({}, { status_code: 400, call_id: null, body: {} }), { title: "Texts please", description: "Text me when it is booked." });
    expect(refused.execution).toMatchObject({ status: "FAILED", summary: "BoroughSim answered 400" });
    expect(refused.threadWrites).toEqual([]);
  });
});

describe("GET_FEATURE_REQUEST", () => {
  it("is offered only when the resident has filed one, and only offers their ids", () => {
    expect(get.runnable(context())).toBe(true);
    expect(get.runnable(context({ featureRequests: [] }))).toBe(false);
    expect(get.inputSchema(context())).toMatchObject({ properties: { feature_request_id: { enum: [FR_ID] } } });
  });

  it("checks a feature request the resident filed, and remembers its status", async () => {
    const ctx = context({}, { status_code: 200, call_id: "C", body: { feature_request_id: FR_ID, status: "CLOSED", status_reason_description: "Shipped.", title: "T" } });
    const outcome = await get.run(ctx, { feature_request_id: FR_ID });
    expect(ctx.call).toHaveBeenCalledWith({ method: "GET", path: `/v1/feature-requests/${FR_ID}`, headers: { "X-Requester": "resident:hawthorn" } });
    expect(outcome.execution.summary).toBe(`Feature request ${FR_ID} is closed: Shipped..`);
    expect(outcome.threadWrites).toEqual([{ kind: "FEATURE_REQUEST_CHECKED", feature_request_id: FR_ID, status: "CLOSED", status_reason: "Shipped.", at: NOW.toISOString() }]);
    const plain = await get.run(context({}, { status_code: 200, call_id: "C", body: { feature_request_id: FR_ID, status: "RECEIVED", status_reason_description: null, title: "T" } }), { feature_request_id: FR_ID });
    expect(plain.execution.summary).toBe(`Feature request ${FR_ID} is received.`);
  });

  it("refuses an id the resident didn't file without calling, and records a 404", async () => {
    const ctx = context({}, { status_code: 200, call_id: null, body: {} });
    for (const input of [{ feature_request_id: "SOMEONE_ELSES" }, {}]) {
      const outcome = await get.run(ctx, input);
      expect(outcome.execution.status).toBe("FAILED");
    }
    expect(ctx.call).not.toHaveBeenCalled();
    const missing = await get.run(context({}, { status_code: 404, call_id: null, body: { error: { code: "NOT_FOUND", message: "gone" } } }), { feature_request_id: FR_ID });
    expect(missing.execution.summary).toBe("BoroughSim answered 404 NOT_FOUND: gone");
  });
});

describe("truncateBody", () => {
  it("keeps small bodies and cuts large ones", () => {
    expect(truncateBody({ a: 1 })).toEqual({ a: 1 });
    expect(truncateBody("x".repeat(MAX_STORED_BODY_CHARS + 10))).toEqual({ truncated: true, text: "x".repeat(MAX_STORED_BODY_CHARS) });
  });
});

describe("GET_FEATURE_REQUEST on an idea that follows one up", () => {
  const anchored = { ...featureIdea, feature_request_id: FR_ID };

  it("takes the id from the idea, offering no input, even before the thread is listed", async () => {
    const ctx = context({ idea: anchored, featureRequests: [] }, { status_code: 200, call_id: "C", body: { feature_request_id: FR_ID, status: "RECEIVED", status_reason_description: null, title: "T" } });
    expect(get.runnable(ctx)).toBe(true);
    expect(get.inputSchema(ctx)).toEqual({ type: "object", properties: {} });
    const outcome = await get.run(ctx, { feature_request_id: "IGNORED" });
    expect(outcome.execution.status).toBe("FAILED");
    expect(ctx.call).not.toHaveBeenCalled();

    const withThread = context({ idea: anchored }, { status_code: 200, call_id: "C", body: { feature_request_id: FR_ID, status: "RECEIVED", status_reason_description: null, title: "T" } });
    await get.run(withThread, { feature_request_id: "IGNORED" });
    expect(withThread.call).toHaveBeenCalledWith(expect.objectContaining({ path: `/v1/feature-requests/${FR_ID}` }));
  });
});
