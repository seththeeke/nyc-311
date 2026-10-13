import { describe, expect, it } from "vitest";
import { Webhook } from "standardwebhooks";
import { verifyWebhook } from "../../../service/webhook/webhookSignature";
import { SECRET } from "../../fixtures";

const NOW = new Date("2026-10-10T14:03:11.000Z");
const TIMESTAMP = String(Math.floor(NOW.getTime() / 1000));
const BODY = JSON.stringify({ type: "ORDER_ACCEPTED", data: { order_id: "01ORDER" } });
const ID = "evt_01ORDER_1";

/* Every delivery here is signed by the Standard Webhooks reference implementation, a test-only dependency. */
const headers = { "webhook-id": ID, "webhook-timestamp": TIMESTAMP, "webhook-signature": new Webhook(SECRET).sign(ID, NOW, BODY) };

describe("verifyWebhook against deliveries signed by the reference implementation", () => {
  it("accepts a correctly signed delivery, with or without the whsec_ prefix on the stored secret", () => {
    expect(verifyWebhook({ secret: SECRET, headers, body: BODY, now: NOW })).toBe(true);
    expect(verifyWebhook({ secret: SECRET.slice("whsec_".length), headers, body: BODY, now: NOW })).toBe(true);
  });

  it("accepts one valid signature among several, as during a secret rotation", () => {
    const rotated = { ...headers, "webhook-signature": `v1,bm9wZQ== v2,ignored malformed ${headers["webhook-signature"]}` };
    expect(verifyWebhook({ secret: SECRET, headers: rotated, body: BODY, now: NOW })).toBe(true);
  });

  it("rejects a tampered body, a different secret and a wrong-length signature", () => {
    expect(verifyWebhook({ secret: SECRET, headers, body: `${BODY} `, now: NOW })).toBe(false);
    expect(verifyWebhook({ secret: "whsec_b3RoZXJvdGhlcm90aGVyb3RoZXJvdGhlcm90aGVy", headers, body: BODY, now: NOW })).toBe(false);
    expect(verifyWebhook({ secret: SECRET, headers: { ...headers, "webhook-signature": "v1,short" }, body: BODY, now: NOW })).toBe(false);
  });

  it("rejects a delivery signed for a different webhook id", () => {
    expect(verifyWebhook({ secret: SECRET, headers: { ...headers, "webhook-id": "evt_01OTHER_1" }, body: BODY, now: NOW })).toBe(false);
  });

  it("rejects a missing header and a non-numeric timestamp", () => {
    for (const name of ["webhook-id", "webhook-timestamp", "webhook-signature"]) {
      expect(verifyWebhook({ secret: SECRET, headers: { ...headers, [name]: undefined }, body: BODY, now: NOW })).toBe(false);
    }
    expect(verifyWebhook({ secret: SECRET, headers: { ...headers, "webhook-timestamp": "soon" }, body: BODY, now: NOW })).toBe(false);
  });

  it("rejects a timestamp outside the five-minute window in either direction", () => {
    expect(verifyWebhook({ secret: SECRET, headers, body: BODY, now: new Date(NOW.getTime() + 301_000) })).toBe(false);
    expect(verifyWebhook({ secret: SECRET, headers, body: BODY, now: new Date(NOW.getTime() - 301_000) })).toBe(false);
    expect(verifyWebhook({ secret: SECRET, headers, body: BODY, now: new Date(NOW.getTime() + 299_000) })).toBe(true);
  });
});
