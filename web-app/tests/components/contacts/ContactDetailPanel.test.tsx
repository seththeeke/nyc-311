import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ContactDetailPanel } from "../../../src/components/contacts/ContactDetailPanel";
import { contactTimeline } from "../../../src/components/contacts/ContactTimeline";
import { CONTACTS_QUERY_KEY } from "../../../src/hooks/useContacts";
import type { Contact } from "../../../src/models/contact";
import { MOCK_CONTACTS } from "../../../src/test-data/contacts";
import { MOCK_RESIDENT_PERSONAS } from "../../../src/test-data/residentPersonas";

vi.mock("../../../src/hooks/useResidentAvatar", () => ({ useResidentAvatar: () => null }));
vi.mock("../../../src/hooks/useResidentPersonas", () => ({ useResidentPersonas: () => ({ data: MOCK_RESIDENT_PERSONAS }) }));

const [received, inProgress, closed] = MOCK_CONTACTS;
const stranger: Contact = { ...received, contact_id: "01STRANGER", submitter_name: "Nobody Known" };

function Search() {
  return <output aria-label="search">{useLocation().search}</output>;
}

function renderPanel(search: string) {
  const client = new QueryClient();
  client.setQueryData([...CONTACTS_QUERY_KEY, "FEATURE_REQUEST", null, "NEWEST"], { pages: [{ contacts: [...MOCK_CONTACTS, stranger], next_cursor: null }], pageParams: [null] });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/contacts${search}`]}>
        <ContactDetailPanel />
        <Search />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("ContactDetailPanel", () => {
  it("asks for a selection, and says when the contact isn't loaded", () => {
    const { unmount } = renderPanel("");
    expect(screen.getByText("Select a contact to see its details here.")).toBeInTheDocument();
    unmount();
    renderPanel("?contact=01GONE");
    expect(screen.getByText(/isn't in the loaded list/)).toBeInTheDocument();
  });

  it("shows the resident, the request, the response and the history, and closes", async () => {
    renderPanel(`?contact=${closed.contact_id}`);
    const panel = screen.getByRole("region", { name: "Contact details" });
    expect(within(panel).getByText(closed.submitter_name)).toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: `See ${closed.submitter_name}'s ideas` })).toHaveAttribute("href", "/residents?persona=juniper");
    expect(within(panel).getByRole("heading", { name: closed.title })).toBeInTheDocument();
    expect(within(panel).getByText("Closed · Duplicate")).toBeInTheDocument();
    expect(within(panel).getByText(closed.closure_reason_description!)).toBeInTheDocument();
    expect(within(panel).getByText("Ticket #170")).toBeInTheDocument();
    const history = within(panel).getByRole("list", { name: "Status history" });
    const steps = within(history).getAllByRole("listitem");
    expect(steps.map((step) => step.textContent)).toEqual([expect.stringMatching(/^Received\w{3} \d+, 2026$/), expect.stringMatching(/^Closed\w{3} \d+, 2026$/)]);
    expect(steps[1]).toHaveAttribute("aria-current", "step");
    expect(steps[0]).not.toHaveAttribute("aria-current");
    await userEvent.setup().click(within(panel).getByRole("button", { name: "Close contact" }));
    expect(screen.getByLabelText("search")).toHaveTextContent(/^$/);
  });

  it("leaves out the response box, and the resident link for a name no resident has", () => {
    renderPanel(`?contact=${stranger.contact_id}`);
    expect(screen.getByText("Nobody Known")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByText("BoroughSim's response")).not.toBeInTheDocument();
  });
});

describe("contactTimeline", () => {
  it("dates only arrival and the latest change, and skips In progress once closed", () => {
    expect(contactTimeline(received).map((s) => [s.label, s.state, s.date])).toEqual([
      ["Received", "CURRENT", received.created_at],
      ["In progress", "UPCOMING", null],
      ["Closed", "UPCOMING", null],
    ]);
    expect(contactTimeline(inProgress).map((s) => [s.label, s.state, s.date])).toEqual([
      ["Received", "DONE", inProgress.created_at],
      ["In progress", "CURRENT", inProgress.updated_at],
      ["Closed", "UPCOMING", null],
    ]);
    expect(contactTimeline(closed).map((s) => [s.label, s.state, s.date])).toEqual([
      ["Received", "DONE", closed.created_at],
      ["Closed", "CURRENT", closed.updated_at],
    ]);
  });
});
