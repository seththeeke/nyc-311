/**
 * Real-integration tier (testing-framework.md §4): the public `GET /contacts`
 * route (17-executive-team.md §17.3) against a live API. Read-only, so it
 * runs against whatever contacts the environment has, possibly none.
 */

import { describe, expect, it } from "vitest";
import { ContactListPageSchema } from "../../models/contactList";
import { getJson } from "./support/httpClient";

describe("GET /contacts against a live API", () => {
  it("returns a page of feature requests, newest first, with no emails", async () => {
    const response = await getJson("/contacts", "/contacts?type=FEATURE_REQUEST&limit=5");
    expect(response.status).toBe(200);
    const page = ContactListPageSchema.parse(response.body);
    expect(page.contacts.length).toBeLessThanOrEqual(5);
    const times = page.contacts.map((c) => c.created_at);
    expect([...times].sort().reverse()).toEqual(times);
    expect(JSON.stringify(page)).not.toContain("email");
  });

  it("rejects an invalid query with 400", async () => {
    expect((await getJson("/contacts", "/contacts?status=OPEN")).status).toBe(400);
  });
});
