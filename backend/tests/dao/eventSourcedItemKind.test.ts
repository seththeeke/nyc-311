import { describe, expect, it } from "vitest";
import { eventSourcedItemKind } from "../../dao/eventSourcedItemKind";

describe("eventSourcedItemKind", () => {
  it("classifies the #METADATA row as the projection", () => {
    expect(eventSourcedItemKind("#METADATA")).toBe("PROJECTION");
  });

  it("classifies an EVENT#<n> row as an event", () => {
    expect(eventSourcedItemKind("EVENT#1")).toBe("EVENT");
    expect(eventSourcedItemKind("EVENT#42")).toBe("EVENT");
  });

  it("returns null for any other sort key or a non-string", () => {
    expect(eventSourcedItemKind("CRID#abc")).toBeNull();
    expect(eventSourcedItemKind("event#1")).toBeNull();
    expect(eventSourcedItemKind(undefined)).toBeNull();
    expect(eventSourcedItemKind(null)).toBeNull();
    expect(eventSourcedItemKind(7)).toBeNull();
  });
});
