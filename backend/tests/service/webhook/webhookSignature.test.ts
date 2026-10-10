import { describe, expect, it } from "vitest";
import { Webhook } from "standardwebhooks";
import { buildWebhookHeaders, signWebhook, verifyWebhook } from "../../../service/webhook/webhookSignature";
import { SECRET } from "./webhookTestFixtures";

const NOW = new Date("2026-10-10T14:03:11.000Z");
const TIMESTAMP = Math.floor(NOW.getTime() / 1000);
const BODY = JSON.stringify({ type: "ORDER_ACCEPTED", data: { order_id: "01ORDER" } });
const ID = "evt_01ORDER_1";
const input = { secret: SECRET, webhookId: ID, timestampSeconds: TIMESTAMP, body: BODY };

/* The reference implementation — a test-only dependency (13-customer-simulation.md §5). */
const reference = new Webhook(SECRET);

describe("signWebhook against the Standard Webhooks reference implementation", () => {
  it("produces the same signature as the reference", () => {
    expect(signWebhook(input)).toBe(reference.sign(ID, NOW, BODY));
  });

  it("produces headers the reference verifies", () => {
    const headers = buildWebhookHeaders({ ...input, timestampSeconds: Math.floor(Date.now() / 1000) });
    expect(() => reference.verify(BODY, headers)).not.toThrow();
  });

  it("treats a secret without the whsec_ prefix as the same key", () => {
    expect(signWebhook({ ...input, secret: SECRET.slice("whsec_".length) })).toBe(signWebhook(input));
  });
});

describe("verifyWebhook", () => {
  const headers = buildWebhookHeaders(input);

  it("accepts a delivery signed by the reference implementation", () => {
    const referenceHeaders = { "webhook-id": ID, "webhook-timestamp": String(TIMESTAMP), "webhook-signature": reference.sign(ID, NOW, BODY) };
    expect(verifyWebhook({ secret: SECRET, headers: referenceHeaders, body: BODY, now: NOW })).toBe(true);
  });

  it("accepts its own signature, and one of several space-separated signatures", () => {
    expect(verifyWebhook({ secret: SECRET, headers, body: BODY, now: NOW })).toBe(true);
    const rotated = { ...headers, "webhook-signature": `v1,bm9wZQ== v2,ignored malformed ${headers["webhook-signature"]}` };
    expect(verifyWebhook({ secret: SECRET, headers: rotated, body: BODY, now: NOW })).toBe(true);
  });

  it("rejects a tampered body, a wrong secret and a wrong-length signature", () => {
    expect(verifyWebhook({ secret: SECRET, headers, body: `${BODY} `, now: NOW })).toBe(false);
    expect(verifyWebhook({ secret: "whsec_b3RoZXJvdGhlcm90aGVyb3RoZXJvdGhlcm90aGVy", headers, body: BODY, now: NOW })).toBe(false);
    expect(verifyWebhook({ secret: SECRET, headers: { ...headers, "webhook-signature": "v1,short" }, body: BODY, now: NOW })).toBe(false);
  });

  it("rejects a missing header and a non-numeric timestamp", () => {
    expect(verifyWebhook({ secret: SECRET, headers: { ...headers, "webhook-id": undefined }, body: BODY, now: NOW })).toBe(false);
    expect(verifyWebhook({ secret: SECRET, headers: { ...headers, "webhook-timestamp": undefined }, body: BODY, now: NOW })).toBe(false);
    expect(verifyWebhook({ secret: SECRET, headers: { ...headers, "webhook-signature": undefined }, body: BODY, now: NOW })).toBe(false);
    expect(verifyWebhook({ secret: SECRET, headers: { ...headers, "webhook-timestamp": "soon" }, body: BODY, now: NOW })).toBe(false);
  });

  it("rejects a timestamp outside the five-minute window in either direction", () => {
    const later = new Date(NOW.getTime() + 301_000);
    const earlier = new Date(NOW.getTime() - 301_000);
    expect(verifyWebhook({ secret: SECRET, headers, body: BODY, now: later })).toBe(false);
    expect(verifyWebhook({ secret: SECRET, headers, body: BODY, now: earlier })).toBe(false);
    expect(verifyWebhook({ secret: SECRET, headers, body: BODY, now: new Date(NOW.getTime() + 299_000) })).toBe(true);
  });
});
