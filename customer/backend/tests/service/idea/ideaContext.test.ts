import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ResidentIdeaDao } from "../../../dao/residentIdea/residentIdeaDao";
import type { WebhookCustomerFacingOrderDao } from "../../../dao/webhookCustomerFacingOrder/webhookCustomerFacingOrderDao";
import type { ResidentFeatureRequestThread } from "../../../models/residentIdea";
import { MAX_CANDIDATES, MAX_FEATURE_REQUESTS, describeContext, gatherIdeaContext } from "../../../service/idea/ideaContext";
import { current, featureIdea, idea, order } from "../../residentFixtures";

const NOW = new Date("2026-10-17T14:00:00.000Z");

function filed(id: string, overrides: Partial<ResidentFeatureRequestThread> = {}): ResidentFeatureRequestThread {
  return {
    persona_id: "hawthorn",
    sk: `FEATURE_REQUEST#${id}`,
    feature_request_id: id,
    title: `Request ${id}`,
    filed_by_idea_id: "01IDEA",
    last_known_status: "RECEIVED",
    last_known_status_reason: null,
    last_checked_at: "2026-10-16T09:00:00.000Z",
    created_at: `2026-10-${id.slice(-2)}T09:00:00.000Z`,
    ...overrides,
  };
}

function deps(sampled: ReturnType<typeof order>[], threads: string[] = [], featureRequests: ResidentFeatureRequestThread[] = []) {
  const ideaDao = {
    listThreads: vi.fn().mockResolvedValue(threads.map((id) => ({ order_id: id }))),
    listForResident: vi.fn().mockResolvedValue({ items: [idea, featureIdea], lastKey: null }),
    listFeatureRequestThreads: vi.fn().mockResolvedValue(featureRequests),
  };
  const orderDao = {
    sampleOpenOrders: vi.fn().mockResolvedValue(sampled),
    batchGetOrders: vi.fn().mockResolvedValue([order("01ORDER", { status: "CLOSED", resolved_at: "2026-10-16T10:00:00.000Z" })]),
  };
  return {
    ideaDao,
    orderDao,
    deps: { ideaDao: ideaDao as unknown as ResidentIdeaDao, orderDao: orderDao as unknown as WebhookCustomerFacingOrderDao, random: () => 0.3, pickKey: () => "80" },
  };
}

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("gatherIdeaContext", () => {
  it("offers fresh orders only, preferred descriptors first, capped", async () => {
    const sampled = [
      order("SEEN"),
      order("PLAIN1", { descriptor: "Plate Condition - Noisy" }),
      order("CAVE", { descriptor: "Cave-in" }),
      ...Array.from({ length: 6 }, (_, i) => order(`PLAIN${i + 2}`, { descriptor: "Plate Condition - Noisy" })),
    ];
    const { orderDao, deps: d } = deps(sampled, ["SEEN"]);
    const context = await gatherIdeaContext(current, d);
    expect(context.candidates).toHaveLength(MAX_CANDIDATES);
    expect(context.candidates[0].order_id).toBe("CAVE");
    expect(context.candidates.map((o) => o.order_id)).not.toContain("SEEN");
    expect(orderDao.sampleOpenOrders).toHaveBeenCalledWith("BROOKLYN", "80", 20);
    expect(orderDao.batchGetOrders).toHaveBeenCalledWith(["01ORDER"]);
    expect(context.recentIdeas).toHaveLength(2);
  });

  it("samples every borough until it has enough, with default randomness", async () => {
    const { orderDao, deps: d } = deps([order("A")]);
    const resident = { ...current, interests: { boroughs: ["BROOKLYN", "QUEENS"], descriptors: [] } };
    await gatherIdeaContext(resident, { ideaDao: d.ideaDao, orderDao: d.orderDao });
    expect(orderDao.sampleOpenOrders).toHaveBeenCalledTimes(2);
    expect(orderDao.sampleOpenOrders.mock.calls[0][1]).toMatch(/^[0-9a-f]{16}$/);
  });

  it("stops sampling once a borough alone already yields double the cap", async () => {
    const plenty = Array.from({ length: MAX_CANDIDATES * 2 }, (_, i) => order(`PLENTY${i}`));
    const { orderDao, deps: d } = deps(plenty);
    const resident = { ...current, interests: { boroughs: ["BROOKLYN", "QUEENS", "MANHATTAN"], descriptors: [] } };
    await gatherIdeaContext(resident, d);
    expect(orderDao.sampleOpenOrders).toHaveBeenCalledTimes(1);
  });
});

describe("describeContext", () => {
  it("lists fresh orders, followed orders as they stand, and recent ideas", async () => {
    const { deps: d } = deps([order("FRESH", { accepted_at: "2026-10-15T14:00:00.000Z" })]);
    const text = describeContext(await gatherIdeaContext(current, d), NOW);
    expect(text).toContain("in New York");
    expect(text).toContain("- order FRESH: Pothole at 412 ATLANTIC AVENUE, BROOKLYN; accepted 2 day(s) ago; still open");
    expect(text).toContain("- order 01ORDER: Pothole at 412 ATLANTIC AVENUE, BROOKLYN; accepted");
    expect(text).toContain("marked repaired 2026-10-16T10:00:00.000Z");
    expect(text).toContain("ETA_REQUEST about order 01ORDER: I want a date");
    expect(text).toContain("FEATURE_REQUEST: Let me get a text");
  });

  it("says so when there is nothing new and no history, and copes with missing details", () => {
    const text = describeContext(
      {
        candidates: [],
        recentIdeas: [],
        followedOrders: [order("X", { descriptor: null, address: null, borough: null, status: "CLOSED", resolved_at: null })],
        orderThreads: [],
        featureRequests: [],
      },
      NOW
    );
    expect(text).toContain("There are no new open repair orders near you right now.");
    expect(text).toContain("You have not had any ideas before.");
    expect(text).not.toContain("Feature requests you filed");
    expect(text).toContain("street problem at address unknown");
    expect(text).toMatch(/marked repaired$/m);
  });

  it("adds what the resident learned: their searches, open feature requests and how recent ideas went (docs/16 §5.4)", () => {
    const finished = {
      ...idea,
      feature_request_id: "01FR17",
      resolution: { ...idea.resolution, status: "UNSATISFIED" as const, summary: "Still no date.", follow_up: "Check Friday." },
    };
    const working = { ...featureIdea, resolution: { ...featureIdea.resolution, status: "IN_PROGRESS" as const } };
    const quiet = { ...featureIdea, resolution: { ...featureIdea.resolution, status: "GAVE_UP" as const, summary: null, follow_up: null } };
    const text = describeContext(
      {
        candidates: [],
        recentIdeas: [finished, working, quiet],
        followedOrders: [order("01ORDER")],
        orderThreads: [
          { persona_id: "hawthorn", sk: "ORDER#01ORDER", order_id: "01ORDER", idea_count: 1, first_idea_at: "a", last_idea_at: "a", last_known_status: "SCHEDULED", scheduled_window: { start: "2026-10-20T13:00Z", end: "E" }, last_checked_at: "2026-10-16T09:00:00.000Z" },
        ],
        featureRequests: [filed("01FR17", { last_known_status: "UNDER_REVIEW", last_known_status_reason: "Looking at it" })],
      },
      NOW
    );
    expect(text).toContain("when you last looked it up (2026-10-16) BoroughSim said scheduled, scheduled 2026-10-20T13:00Z");
    expect(text).toContain('- 01FR17: "Request 01FR17", filed 2026-10-17; last seen under review on 2026-10-16 (Looking at it)');
    expect(text).toContain('following up feature request 01FR17: I want a date for the trench outside my shop. → unsatisfied. You said: "Still no date." You meant to check: Check Friday.');
    expect(text).toContain("(you are still working on it)");
    expect(text).toMatch(/→ gave up\.$/m);
  });

  it("shows a search that found nothing scheduled", () => {
    const text = describeContext(
      {
        candidates: [],
        recentIdeas: [],
        followedOrders: [order("01ORDER")],
        orderThreads: [{ persona_id: "hawthorn", sk: "ORDER#01ORDER", order_id: "01ORDER", idea_count: 1, first_idea_at: "a", last_idea_at: "a", last_known_status: "ACCEPTED", scheduled_window: null, last_checked_at: "2026-10-16T09:00:00.000Z" }],
        featureRequests: [],
      },
      NOW
    );
    expect(text).toContain("BoroughSim said accepted");
  });
});

describe("gatherIdeaContext feature requests", () => {
  it("offers only open feature requests, newest first, capped", async () => {
    const threads = [filed("01FR10", { last_known_status: "CLOSED" }), ...["01FR11", "01FR12", "01FR13", "01FR14", "01FR15", "01FR16"].map((id) => filed(id))];
    const { deps: d } = deps([], [], threads);
    const context = await gatherIdeaContext(current, d);
    expect(context.featureRequests.map((thread) => thread.feature_request_id)).toEqual(["01FR16", "01FR15", "01FR14", "01FR13", "01FR12"]);
    expect(context.featureRequests).toHaveLength(MAX_FEATURE_REQUESTS);
  });
});
