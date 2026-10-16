import { describe, expect, it } from "vitest";
import { PersonaPanel } from "../../../src/components/customers/PersonaPanel";
import { ResidentDetailPanel } from "../../../src/components/customers/ResidentDetailPanel";
import { secondaryContentFor } from "../../../src/components/shell/secondaryContent";

describe("secondaryContentFor", () => {
  it("gives the feed the resident list and an Idea Detail view its resident, and every other route the widgets", () => {
    expect(secondaryContentFor("/residents")).toBe(PersonaPanel);
    expect(secondaryContentFor("/residents/hawthorn/ideas/01K7IDEA0014")).toBe(ResidentDetailPanel);
    expect(secondaryContentFor("/residents/hawthorn")).toBeNull();
    expect(secondaryContentFor("/")).toBeNull();
    expect(secondaryContentFor("/customers")).toBeNull();
  });
});
