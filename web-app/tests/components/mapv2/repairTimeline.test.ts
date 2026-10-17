import { describe, expect, it } from "vitest";
import { loopSeconds, phaseProgress, phasesFor, representativeSeconds, scriptFor, timelineAt } from "../../../src/components/mapv2/repairTimeline";

describe("scriptFor", () => {
  it("plays the street repair only for Street Condition jobs", () => {
    expect(scriptFor("Street Condition")).toBe("STREET_REPAIR");
    expect(scriptFor("Noise")).toBe("GENERIC");
    expect(scriptFor(null)).toBe("GENERIC");
  });
});

describe("phasesFor / loopSeconds", () => {
  it("lists the repair in order with labels, and sums its durations", () => {
    expect(phasesFor("STREET_REPAIR").map((p) => p.phase)).toEqual(["ARRIVE", "SECURE", "CUT", "CLEAR", "FILL", "COMPACT", "DONE"]);
    expect(phasesFor("GENERIC").map((p) => p.label)).toEqual(["Crew arrives", "Site coned off", "Crew at work", "Site reopened"]);
    expect(loopSeconds("STREET_REPAIR")).toBe(25);
    expect(loopSeconds("GENERIC")).toBe(18.5);
  });
});

describe("timelineAt", () => {
  it("starts at ARRIVE and clamps negative time", () => {
    expect(timelineAt("STREET_REPAIR", -5)).toEqual({ phase: "ARRIVE", index: 0, progress: 0, loopProgress: 0 });
  });

  it("finds the phase and progress within it", () => {
    const state = timelineAt("STREET_REPAIR", 3.5 + 3 + 2);
    expect(state.phase).toBe("CUT");
    expect(state.index).toBe(2);
    expect(state.progress).toBeCloseTo(0.5);
  });

  it("loops back to the start", () => {
    expect(timelineAt("GENERIC", 18.5 + 1).phase).toBe("ARRIVE");
    expect(timelineAt("GENERIC", 18.4).phase).toBe("DONE");
  });
});

describe("phaseProgress", () => {
  it("is 0 before, fractional during and 1 after a phase", () => {
    expect(phaseProgress("STREET_REPAIR", 1, "CUT")).toBe(0);
    expect(phaseProgress("STREET_REPAIR", 6.5 + 1, "CUT")).toBeCloseTo(0.25);
    expect(phaseProgress("STREET_REPAIR", 20, "CUT")).toBe(1);
  });

  it("is 0 for a phase the script doesn't have", () => {
    expect(phaseProgress("GENERIC", 10, "FILL")).toBe(0);
  });
});

describe("representativeSeconds", () => {
  it("freezes mid-pour for a repair and mid-work otherwise", () => {
    expect(timelineAt("STREET_REPAIR", representativeSeconds("STREET_REPAIR")).phase).toBe("FILL");
    expect(timelineAt("GENERIC", representativeSeconds("GENERIC")).phase).toBe("WORK");
  });
});
