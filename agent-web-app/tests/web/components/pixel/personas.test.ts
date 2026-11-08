import { describe, expect, it } from "vitest";
import { ROSTER_ORDER, personaFor } from "../../../../web/components/pixel/personas.ts";
import { describeState, roomStateOf } from "../../../../web/components/pixel/roomState.ts";
import { makeAgent, makeRun } from "../../fixtures.tsx";

describe("personas", () => {
  it("knows the team, and gives anyone else the server closet", () => {
    expect(ROSTER_ORDER).toContain("devx-agent");
    expect(personaFor("devx-agent")).toMatchObject({ name: "Pip Sprocketwhistle", room: "The Workshop" });
    expect(personaFor("new-agent")).toMatchObject({ name: "new-agent", title: "Agent", room: "The Server Closet" });
  });
});

describe("roomStateOf", () => {
  it("works during a run, alerts on an error, sleeps when not loaded, else idles", () => {
    const base = makeAgent();
    expect(roomStateOf(makeAgent({ currentRun: makeRun({ status: "RUNNING" }) }))).toBe("WORKING");
    expect(roomStateOf(makeAgent({ health: [{ severity: "ERROR", code: "X", message: "x" }] }))).toBe("ALERT");
    expect(roomStateOf(makeAgent({ job: { ...base.job, loaded: false } }))).toBe("ASLEEP");
    expect(roomStateOf(makeAgent({ health: [{ severity: "WARN", code: "X", message: "x" }] }))).toBe("IDLE");
    expect(describeState("ASLEEP")).toContain("asleep");
  });
});
