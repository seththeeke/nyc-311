import { describe, expect, it } from "vitest";
import { PersonaPanel } from "../../../src/components/customers/PersonaPanel";
import { secondaryContentFor } from "../../../src/components/shell/secondaryContent";

describe("secondaryContentFor", () => {
  it("gives /customers the persona panel, and every other route the default widgets", () => {
    expect(secondaryContentFor("/customers")).toBe(PersonaPanel);
    expect(secondaryContentFor("/")).toBeNull();
    expect(secondaryContentFor("/customers/extra")).toBeNull();
  });
});
