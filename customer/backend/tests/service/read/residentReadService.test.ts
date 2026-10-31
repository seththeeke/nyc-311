import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ResidentDao } from "../../../dao/resident/residentDao";
import type { ResidentIdeaDao } from "../../../dao/residentIdea/residentIdeaDao";
import type { WebhookCustomerFacingOrderDao } from "../../../dao/webhookCustomerFacingOrder/webhookCustomerFacingOrderDao";
import { NotFoundError, ValidationError } from "../../../models/errors";
import { getIdea, getResident, listIdeas, listResidents, parseLimit, type ResidentReadDeps } from "../../../service/read/residentReadService";
import { ResidentIdeaDetailViewSchema } from "../../../models/residentView";
import { current, featureIdea, idea, order, searchStep } from "../../residentFixtures";

const cursorFor = (key: Record<string, string>) => Buffer.from(JSON.stringify(key)).toString("base64url");

function setup() {
  const residentDao = {
    listCurrent: vi.fn().mockResolvedValue({ items: [current], lastKey: "next" }),
    getCurrent: vi.fn().mockResolvedValueOnce(current).mockResolvedValueOnce(null),
  };
  const ideaDao = {
    listForResident: vi.fn().mockResolvedValue({ items: [idea, featureIdea], lastKey: null }),
    listFeed: vi.fn().mockResolvedValue({ items: [featureIdea], lastKey: "more" }),
    getIdeaWithSteps: vi.fn().mockResolvedValueOnce({ idea, steps: [searchStep] }).mockResolvedValueOnce(null),
  };
  const orderDao = { batchGetOrders: vi.fn().mockResolvedValue([order("01ORDER", { descriptor: "Cave-in" })]) };
  const deps: ResidentReadDeps = {
    residentDao: residentDao as unknown as ResidentDao,
    ideaDao: ideaDao as unknown as ResidentIdeaDao,
    orderDao: orderDao as unknown as WebhookCustomerFacingOrderDao,
  };
  return { deps, residentDao, ideaDao, orderDao };
}

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("parseLimit", () => {
  it("defaults to 20 and allows 1 to 50", () => {
    expect(parseLimit(undefined)).toBe(20);
    expect(parseLimit("50")).toBe(50);
    for (const bad of ["0", "51", "2.5", "ten"]) expect(() => parseLimit(bad)).toThrow(ValidationError);
  });
});

describe("resident reads", () => {
  it("lists residents without storage fields, passing the cursor along", async () => {
    const { deps, residentDao } = setup();
    const page = await listResidents(20, cursorFor({ persona_id: "a", sk: "CURRENT", roster_pk: "ALL" }), deps);
    expect(page.nextCursor).toBe("next");
    expect(page.items[0]).not.toHaveProperty("idea_prompt");
    expect(page.items[0]).not.toHaveProperty("content_hash");
    expect(page.items[0]).toMatchObject({ persona_id: "hawthorn", idea_count: 2 });
    expect(residentDao.listCurrent.mock.calls[0][1]).toEqual({ persona_id: "a", sk: "CURRENT", roster_pk: "ALL" });
  });

  it("gets one resident, or 404s", async () => {
    const { deps } = setup();
    await expect(getResident("hawthorn", deps)).resolves.toMatchObject({ name: "Hawthorn" });
    await expect(getResident("nobody", deps)).rejects.toThrow(NotFoundError);
  });
});

describe("idea reads", () => {
  it("lists one resident's ideas with anchors built from the order rows", async () => {
    const { deps, orderDao } = setup();
    const page = await listIdeas({ personaId: "hawthorn", limit: 20 }, deps);
    expect(page.items[0].anchor).toEqual({ order_id: "01ORDER", external_unique_key: "69860415", descriptor: "Cave-in", borough: "BROOKLYN", address: "412 ATLANTIC AVENUE" });
    expect(page.items[1].anchor).toBeNull();
    expect(page.items[0]).not.toHaveProperty("sk");
    expect(orderDao.batchGetOrders).toHaveBeenCalledWith(["01ORDER"]);
  });

  it("lists the feed and skips the order read when no idea has an order", async () => {
    const { deps, orderDao } = setup();
    await expect(listIdeas({ limit: 5 }, deps)).resolves.toMatchObject({ nextCursor: "more" });
    expect(orderDao.batchGetOrders).not.toHaveBeenCalled();
  });

  it("rejects a cursor issued for another resident", async () => {
    const { deps } = setup();
    await expect(listIdeas({ personaId: "hawthorn", limit: 20, cursor: cursorFor({ persona_id: "juniper", sk: "IDEA#1" }) }, deps)).rejects.toThrow(
      "Cursor belongs to another resident"
    );
  });

  it("gets one idea with its steps, keeping its ids when the order row is missing, or 404s", async () => {
    const { deps, orderDao } = setup();
    orderDao.batchGetOrders.mockResolvedValue([]);
    const view = await getIdea("hawthorn", idea.idea_id, deps);
    expect(view).toMatchObject({
      anchor: { order_id: "01ORDER", external_unique_key: "69860415", descriptor: null, borough: null, address: null },
      resolution: { status: "NOT_ACTIONED" },
      feature_request_id: null,
    });
    expect(ResidentIdeaDetailViewSchema.parse(view).steps).toEqual([
      {
        sequence: 1,
        kind: "TOOL_CALL",
        decision: searchStep.decision,
        execution: searchStep.execution,
        input_tokens: 940,
        output_tokens: 38,
        created_at: searchStep.created_at,
      },
    ]);
    expect(view).not.toHaveProperty("status");
    expect(view).not.toHaveProperty("actions");
    await expect(getIdea("hawthorn", "nope", deps)).rejects.toThrow(NotFoundError);
  });

  it("builds its own DAOs from the environment", async () => {
    vi.stubEnv("RESIDENTS_TABLE_NAME", "");
    await expect(getResident("hawthorn")).rejects.toThrow("RESIDENTS_TABLE_NAME");
    await expect(listIdeas({ limit: 1 })).rejects.toThrow("RESIDENT_IDEAS_TABLE_NAME");
    vi.stubEnv("RESIDENTS_TABLE_NAME", "Residents-Prod");
    vi.stubEnv("RESIDENT_IDEAS_TABLE_NAME", "ResidentIdeas-Prod");
    const { deps } = setup();
    await expect(getIdea("hawthorn", idea.idea_id, { ideaDao: deps.ideaDao })).rejects.toThrow("CUSTOMER_ORDERS_TABLE_NAME");
  });
});
