/**
 * Real-integration tier (testing-framework.md §4) — hits the live
 * deployed API's `GET /orders`, target selected by INTEGRATION_TARGET
 * (support/targets.ts). Run with `npm run test:integration:test` etc.
 */

import { describe, expect, it } from "vitest";
import { getJson } from "./support/httpClient";
import { OrderSchema } from "../../models/order";

const ROUTE = "/orders";

interface OrderListBody {
  orders: unknown[];
  nextCursor: string | null;
}

function assertValidPage(body: OrderListBody): void {
  expect(Array.isArray(body.orders)).toBe(true);
  expect("nextCursor" in body).toBe(true);
  for (const order of body.orders) {
    expect(() => OrderSchema.parse(order)).not.toThrow();
  }
}

describe("GET /orders against a live API", () => {
  it("returns 200 with a paginated envelope of well-formed Order records", async () => {
    const { status, body } = await getJson(ROUTE, `${ROUTE}?limit=5`);
    expect(status).toBe(200);
    assertValidPage(body as OrderListBody);
  });

  it("follows nextCursor to a second page when one exists", async () => {
    const { body: firstPage } = await getJson(ROUTE, `${ROUTE}?limit=5`);
    const { nextCursor } = firstPage as OrderListBody;
    if (!nextCursor) return; /* only one page of Orders exists today — nothing further to follow, not a failure */

    const { status, body } = await getJson(ROUTE, `${ROUTE}?limit=5&cursor=${encodeURIComponent(nextCursor)}`);
    expect(status).toBe(200);
    assertValidPage(body as OrderListBody);
  });

  it("filters by stage, never leaking a non-matching stage", async () => {
    const { status, body } = await getJson(ROUTE, `${ROUTE}?limit=20&stage=INGEST`);
    expect(status).toBe(200);
    assertValidPage(body as OrderListBody);
    const page = body as { orders: { current_stage: string }[] };

    const nonIngest = page.orders.filter((order) => order.current_stage !== "INGEST");
    expect(nonIngest).toEqual([]);
  });
});
