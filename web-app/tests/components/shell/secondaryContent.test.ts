import { describe, expect, it } from "vitest";
import { PersonaPanel } from "../../../src/components/residents/PersonaPanel";
import { ResidentDetailPanel } from "../../../src/components/residents/ResidentDetailPanel";
import { secondaryContentFor, secondaryStartsClosed } from "../../../src/components/shell/secondaryContent";
import { ChatSidePanel } from "../../../src/components/team/chat/ChatSidePanel";
import { ContributionsPanel } from "../../../src/components/team/ContributionsPanel";

describe("secondaryContentFor", () => {
  it("gives the feed the resident list and an Idea Detail view its resident, and every other route the widgets", () => {
    expect(secondaryContentFor("/residents")).toBe(PersonaPanel);
    expect(secondaryContentFor("/residents/hawthorn/ideas/01K7IDEA0014")).toBe(ResidentDetailPanel);
    expect(secondaryContentFor("/residents/hawthorn")).toBeNull();
    expect(secondaryContentFor("/")).toBeNull();
    expect(secondaryContentFor("/unknown")).toBeNull();
  });

  it("puts Team Chat threads in the panel, and keeps it closed on the team pages until a thread is open", () => {
    expect(secondaryContentFor("/team/chat")).toBe(ChatSidePanel);
    expect(secondaryContentFor("/team")).toBe(ContributionsPanel);
    expect(secondaryStartsClosed("/team", "")).toBe(true);
    expect(secondaryStartsClosed("/team", "?contributions=coo")).toBe(false);
    expect(secondaryStartsClosed("/team/chat", "?channel=tech-team")).toBe(true);
    expect(secondaryStartsClosed("/team/chat", "?thread=T7")).toBe(false);
    expect(secondaryStartsClosed("/team/chat", "?profile=coo")).toBe(false);
    expect(secondaryStartsClosed("/residents", "")).toBe(false);
  });
});
