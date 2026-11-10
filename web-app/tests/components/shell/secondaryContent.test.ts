import { createElement, Suspense } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { secondaryContentFor, secondaryStartsClosed } from "../../../src/components/shell/secondaryContent";

/* Panels are lazy (#207), so each is stubbed and rendered to prove which one a route resolves to. */
vi.mock("../../../src/components/residents/PersonaPanel", () => ({
  PersonaPanel: () => createElement("p", null, "persona panel"),
}));
vi.mock("../../../src/components/residents/ResidentDetailPanel", () => ({
  ResidentDetailPanel: () => createElement("p", null, "resident detail panel"),
}));
vi.mock("../../../src/components/contacts/ContactDetailPanel", () => ({
  ContactDetailPanel: () => createElement("p", null, "contact detail panel"),
}));
vi.mock("../../../src/components/team/ContributionsPanel", () => ({
  ContributionsPanel: () => createElement("p", null, "contributions panel"),
}));
vi.mock("../../../src/components/team/chat/ChatSidePanel", () => ({
  ChatSidePanel: () => createElement("p", null, "chat side panel"),
}));

async function expectPanel(pathname: string, text: string): Promise<void> {
  const Panel = secondaryContentFor(pathname);
  expect(Panel).not.toBeNull();
  if (!Panel) return;
  const { unmount } = render(createElement(Suspense, { fallback: null }, createElement(Panel)));
  expect(await screen.findByText(text)).toBeInTheDocument();
  unmount();
}

describe("secondaryContentFor", () => {
  it("gives the feed the resident list and an Idea Detail view its resident, and every other route the widgets", async () => {
    await expectPanel("/residents", "persona panel");
    await expectPanel("/residents/hawthorn/ideas/01K7IDEA0014", "resident detail panel");
    expect(secondaryContentFor("/residents/hawthorn")).toBeNull();
    expect(secondaryContentFor("/")).toBeNull();
    expect(secondaryContentFor("/unknown")).toBeNull();
  });

  it("returns the same lazy component on every lookup, so a re-render never remounts the panel", () => {
    expect(secondaryContentFor("/residents")).toBe(secondaryContentFor("/residents"));
  });

  it("puts Team Chat threads in the panel, and keeps it closed on the team pages until a thread is open", async () => {
    await expectPanel("/team/chat", "chat side panel");
    await expectPanel("/team", "contributions panel");
    expect(secondaryStartsClosed("/team", "")).toBe(true);
    expect(secondaryStartsClosed("/team", "?contributions=coo")).toBe(false);
    expect(secondaryStartsClosed("/team/chat", "?channel=tech-team")).toBe(true);
    expect(secondaryStartsClosed("/team/chat", "?thread=T7")).toBe(false);
    expect(secondaryStartsClosed("/team/chat", "?profile=coo")).toBe(false);
    expect(secondaryStartsClosed("/residents", "")).toBe(false);
  });

  it("puts a contact's details in the panel on Contacts, closed until one is open", async () => {
    await expectPanel("/contacts", "contact detail panel");
    expect(secondaryStartsClosed("/contacts", "")).toBe(true);
    expect(secondaryStartsClosed("/contacts", "?contact=01C")).toBe(false);
  });
});
