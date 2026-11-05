import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContactsPage } from "../../../src/components/pages/ContactsPage";
import { ContactRow } from "../../../src/components/residents/ContactRow";
import { contactStatusText } from "../../../src/components/residents/contactFormat";
import { ResidentsTabs } from "../../../src/components/residents/ResidentsTabs";
import { useFeatureEnabled } from "../../../src/hooks/useFeatureTreatment";
import { contactService } from "../../../src/services/contactService";
import type { ContactPage, ContactQuery } from "../../../src/models/contact";
import { MOCK_CONTACTS } from "../../../src/test-data/contacts";

vi.mock("../../../src/hooks/useFeatureTreatment", () => ({ useFeatureEnabled: vi.fn(() => true) }));

function wrap(ui: ReactElement, path = "/residents/contacts") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

/* Pages the baked contacts two at a time, whatever data mode the run uses. */
async function fakeList(query: ContactQuery, cursor: string | null): Promise<ContactPage> {
  const matching = MOCK_CONTACTS.filter((c) => !query.status || c.status === query.status);
  const sorted = query.order === "NEWEST" ? [...matching] : [...matching].reverse();
  const start = cursor ? Number(cursor) : 0;
  return { contacts: sorted.slice(start, start + 2), next_cursor: start + 2 < sorted.length ? String(start + 2) : null };
}

beforeEach(() => {
  vi.spyOn(contactService, "listContacts").mockImplementation(fakeList);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Contacts", () => {
  it("lists feature requests with tabs, filters and Load more", async () => {
    wrap(<ContactsPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Residents" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Contacts" })).toHaveAttribute("aria-current", "page");
    expect(await screen.findByText(MOCK_CONTACTS[0].title)).toBeInTheDocument();
    expect(screen.queryByText(MOCK_CONTACTS[2].title)).not.toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findByText(MOCK_CONTACTS[2].title)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Status"), "IN_PROGRESS");
    await waitFor(() => expect(screen.queryByText(MOCK_CONTACTS[0].title)).not.toBeInTheDocument());
    expect(screen.getByText(MOCK_CONTACTS[1].title)).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Status"), "ALL");
    await user.selectOptions(screen.getByLabelText("Sort"), "OLDEST");
    expect(await screen.findByText(MOCK_CONTACTS[2].title)).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Type"), "FEATURE_REQUEST");
  });

  it("says when nothing matches, and shows a load error", async () => {
    vi.mocked(contactService.listContacts).mockResolvedValueOnce({ contacts: [], next_cursor: null });
    const { unmount } = wrap(<ContactsPage />);
    expect(await screen.findByText("No contacts match these filters yet.")).toBeInTheDocument();
    unmount();
    vi.mocked(contactService.listContacts).mockRejectedValueOnce(new Error("HTTP 500"));
    wrap(<ContactsPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load contacts: HTTP 500");
  });

  it("shows a contact's status, reason and ticket number as text, never a link", () => {
    wrap(<ContactRow contact={MOCK_CONTACTS[2]} />);
    expect(screen.getByText("Closed · Duplicate")).toBeInTheDocument();
    expect(screen.getByText(MOCK_CONTACTS[2].closure_reason_description!)).toBeInTheDocument();
    expect(screen.getByText(/Ticket #170/)).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(contactStatusText("CLOSED", "LATER")).toBe("Closed · LATER");
    expect(contactStatusText("RECEIVED", null)).toBe("Received");
  });

  it("hides the tabs while CONTACTS_PAGE is off", () => {
    vi.mocked(useFeatureEnabled).mockReturnValueOnce(false);
    const { container } = wrap(<ResidentsTabs />, "/residents");
    expect(container).toBeEmptyDOMElement();
  });
});
