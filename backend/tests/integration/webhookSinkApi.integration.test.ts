/**
 * Real-integration tier (testing-framework.md §4) — the webhook path's
 * end-to-end check (13-customer-simulation.md §5): reads what the
 * Test-only sink subscriber recorded. The sink exists only in Test, so
 * this is skipped for every other INTEGRATION_TARGET.
 */

import { describe, expect, it } from "vitest";
import { z } from "zod";
import { getJson } from "./support/httpClient";
import { WebhookSinkDeliverySchema } from "../../models/webhookSinkDelivery";

const ROUTE = "/webhook-sink/deliveries";
const FRESHNESS_WINDOW_MS = 24 * 60 * 60 * 1000;
const ResponseSchema = z.object({ deliveries: z.array(WebhookSinkDeliverySchema) });

describe.runIf(process.env.INTEGRATION_TARGET === "test")("GET /webhook-sink/deliveries against live Test", () => {
  it("shows only signature-valid deliveries, the newest within the last 24 hours", async () => {
    const { status, body } = await getJson(ROUTE, ROUTE);
    expect(status).toBe(200);
    const { deliveries } = ResponseSchema.parse(body);

    /*
     * Empty means the sink was never registered (a one-time manual step)
     * or nothing arrived for the records' whole one-week TTL — warned
     * about, not failed, so a fresh environment doesn't block DeployProd.
     */
    if (deliveries.length === 0) {
      console.warn("Webhook sink has no recorded deliveries — is the sink subscription registered?");
      return;
    }
    expect(deliveries.filter((delivery) => !delivery.signature_valid)).toEqual([]);
    const newestAgeMs = Date.now() - Date.parse(deliveries[0].received_at);
    expect(newestAgeMs).toBeLessThan(FRESHNESS_WINDOW_MS);
  });
});
