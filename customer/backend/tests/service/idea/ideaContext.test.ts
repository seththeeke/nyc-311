import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ResidentIdeaDao } from "../../../dao/residentIdea/residentIdeaDao";
import type { WebhookCustomerFacingOrderDao } from "../../../dao/webhookCustomerFacingOrder/webhookCustomerFacingOrderDao";
import { MAX_CANDIDATES, describeContext, gatherIdeaContext } from "../../../service/idea/ideaContext";
import { current, featureIdea, idea, order } from "../../residentFixtures";

const NOW = new Date("2026-10-17T14:00:00.000Z");

function deps(sampled: ReturnType<typeof order>[], threads: string[] = []) {
  const ideaDao = {
    listThreads: vi.fn().mockResolvedValue(threads.map((id) => ({ order_id: id }))),
    listForResident: vi.fn().mockResolvedValue({ items: [idea, featureIdea], lastKey: null }),
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
      { candidates: [], recentIdeas: [], followedOrders: [order("X", { descriptor: null, address: null, borough: null, status: "CLOSED", resolved_at: null })] },
      NOW
    );
    expect(text).toContain("There are no new open repair orders near you right now.");
    expect(text).toContain("You have not raised anything before.");
    expect(text).toContain("street problem at address unknown");
    expect(text).toMatch(/marked repaired$/m);
  });
});
