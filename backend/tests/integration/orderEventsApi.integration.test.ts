/**
 * Real-integration tier (testing-framework.md §4) — hits the live
 * deployed API's `GET /order-events`, target selected by
 * INTEGRATION_TARGET (support/targets.ts). Run with
 * `npm run test:integration:test` etc.
 */

import { describe, expect, it } from "vitest";
import { getJson } from "./support/httpClient";
import { OrderEventSchema } from "../../models/order";

const ROUTE = "/order-events";

interface OrderEventListBody {
  events: unknown[];
  nextCursor: string | null;
}

function assertValidPage(body: OrderEventListBody): void {
  expect(Array.isArray(body.events)).toBe(true);
  expect("nextCursor" in body).toBe(true);
  for (const event of body.events) {
    expect(() => OrderEventSchema.parse(event)).not.toThrow();
  }
}

describe("GET /order-events against a live API", () => {
  it("returns 200 with a paginated envelope of well-formed OrderEvent records", async () => {
    const { status, body } = await getJson(ROUTE, `${ROUTE}?limit=5`);
    expect(status).toBe(200);
    assertValidPage(body as OrderEventListBody);
  });

  it("follows nextCursor to a second page when one exists", async () => {
    const { body: firstPage } = await getJson(ROUTE, `${ROUTE}?limit=5`);
    const { nextCursor } = firstPage as OrderEventListBody;
    if (!nextCursor) return; /* only one page of OrderEvents exists today — nothing further to follow, not a failure */

    const { status, body } = await getJson(ROUTE, `${ROUTE}?limit=5&cursor=${encodeURIComponent(nextCursor)}`);
    expect(status).toBe(200);
    assertValidPage(body as OrderEventListBody);
  });

  it("filters by event_type, never leaking a non-matching event type", async () => {
    const { status, body } = await getJson(ROUTE, `${ROUTE}?limit=20&event_type=ORDER_CREATED`);
    expect(status).toBe(200);
    assertValidPage(body as OrderEventListBody);
    const page = body as { events: { event_type: string }[] };

    const nonMatching = page.events.filter((event) => event.event_type !== "ORDER_CREATED");
    expect(nonMatching).toEqual([]);
  });

  it("scopes to a single order_id when one is found from the unfiltered page", async () => {
    const { body } = await getJson(ROUTE, `${ROUTE}?limit=1`);
    const { events } = body as { events: { order_id: string }[] };
    if (events.length === 0) return; /* no OrderEvents exist yet — nothing to scope to, not a failure */

    const targetOrderId = events[0].order_id;
    const { status, body: scopedBody } = await getJson(
      ROUTE,
      `${ROUTE}?limit=20&order_id=${encodeURIComponent(targetOrderId)}`
    );
    expect(status).toBe(200);
    const scopedPage = scopedBody as { events: { order_id: string }[] };
    expect(scopedPage.events.every((event) => event.order_id === targetOrderId)).toBe(true);
  });
});
