import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IdeaFeed } from "../../../src/components/customers/IdeaFeed";
import { useCustomerIdeas } from "../../../src/hooks/useCustomerIdeas";
import { useCustomerPersonas } from "../../../src/hooks/useCustomerPersonas";
import type { CustomerIdea } from "../../../src/models/customerIdea";
import { MOCK_CUSTOMER_IDEAS } from "../../../src/test-data/customerIdeas";
import { MOCK_CUSTOMER_PERSONAS } from "../../../src/test-data/customerPersonas";
import { inRouter } from "./customerFixtures";

vi.mock("../../../src/hooks/useCustomerIdeas", () => ({ useCustomerIdeas: vi.fn() }));
vi.mock("../../../src/hooks/useCustomerPersonas", () => ({ useCustomerPersonas: vi.fn() }));
const mockedIdeas = vi.mocked(useCustomerIdeas);
const mockedPersonas = vi.mocked(useCustomerPersonas);

function setIdeas(state: { data?: CustomerIdea[]; isLoading?: boolean; error?: Error | null }) {
  mockedIdeas.mockImplementation(
    (personaId) =>
      ({
        data: state.data?.filter((idea) => !personaId || idea.persona_id === personaId),
        isLoading: state.isLoading ?? false,
        error: state.error ?? null,
      }) as ReturnType<typeof useCustomerIdeas>,
  );
}

const search = () => screen.getByRole("status", { name: "search" });

beforeEach(() => {
  setIdeas({ data: MOCK_CUSTOMER_IDEAS });
  mockedPersonas.mockReturnValue({ data: MOCK_CUSTOMER_PERSONAS } as ReturnType<typeof useCustomerPersonas>);
});

describe("IdeaFeed — everyone", () => {
  it("lists every idea with its persona, type, order and time, and counts each type", () => {
    render(inRouter(<IdeaFeed />));
    expect(screen.getAllByRole("article")).toHaveLength(MOCK_CUSTOMER_IDEAS.length);
    const first = screen.getAllByRole("article")[0];
    expect(within(first).getByRole("button", { name: "Hawthorn" })).toBeInTheDocument();
    expect(first).not.toHaveTextContent("Escalation");
    expect(within(first).getByText("Not actioned yet")).toBeInTheDocument();
    expect(screen.getAllByText("Requested a feature")).toHaveLength(3);
    expect(screen.getByText("Browsed the website")).toBeInTheDocument();
    expect(within(first).getByRole("link", { name: "View details" })).toHaveAttribute("href", "/residents/hawthorn/ideas/01K7IDEA0014");
    expect(within(first).getByRole("button", { name: "Pothole · 412 ATLANTIC AVENUE, Brooklyn" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: `All ${MOCK_CUSTOMER_IDEAS.length}` })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Feature request 3" })).toBeInTheDocument();
    expect(screen.getAllByText("About the service, not an order")).toHaveLength(3);
  });

  it("filters by type, and a second press clears it", async () => {
    const user = userEvent.setup();
    render(inRouter(<IdeaFeed />));
    await user.click(screen.getByRole("button", { name: "Feature request 3" }));
    expect(search()).toHaveTextContent("?type=FEATURE_REQUEST");
    expect(screen.getAllByRole("article")).toHaveLength(3);
    await user.click(screen.getByRole("button", { name: "Feature request 3" }));
    expect(screen.getAllByRole("article")).toHaveLength(MOCK_CUSTOMER_IDEAS.length);
    await user.click(screen.getByRole("button", { name: "Escalation 1" }));
    await user.click(screen.getByRole("button", { name: `All ${MOCK_CUSTOMER_IDEAS.length}` }));
    expect(search()).toBeEmptyDOMElement();
  });
});

describe("IdeaFeed — focusing", () => {
  it("clicking a persona's name spotlights them, with the prompt behind a disclosure", async () => {
    const user = userEvent.setup();
    render(inRouter(<IdeaFeed />));
    await user.click(within(screen.getAllByRole("article")[1]).getByRole("button", { name: "Sycamore" }));
    expect(search()).toHaveTextContent("?persona=sycamore");
    const spotlight = screen.getByRole("region", { name: "About Sycamore" });
    expect(within(spotlight).getByText(/Drove the Q58/)).toBeInTheDocument();
    expect(within(spotlight).getByText("Persona prompt")).toBeInTheDocument();
    expect(within(spotlight).getByText("07:00–19:00 New York time")).toBeInTheDocument();
    expect(within(spotlight).getByText("Queens")).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(4);
    await user.click(within(spotlight).getByRole("button", { name: "Show everyone" }));
    expect(search()).toBeEmptyDOMElement();
  });

  it("clicking an order shows only its ideas, labelled, until cleared", async () => {
    const user = userEvent.setup();
    render(inRouter(<IdeaFeed />));
    await user.click(within(screen.getAllByRole("article")[0]).getByRole("button", { name: /412 ATLANTIC AVENUE/ }));
    expect(screen.getByText("Ideas about Pothole at 412 ATLANTIC AVENUE")).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(3);
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getAllByRole("article")).toHaveLength(MOCK_CUSTOMER_IDEAS.length);
  });

});

describe("IdeaFeed — states", () => {
  it("shows loading, error and nothing-matches states", () => {
    setIdeas({ isLoading: true });
    const { rerender } = render(inRouter(<IdeaFeed />));
    expect(screen.getByText("Loading ideas…")).toBeInTheDocument();
    setIdeas({ error: new Error("HTTP 404") });
    rerender(inRouter(<IdeaFeed />));
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load ideas: HTTP 404");
    setIdeas({ data: [] });
    rerender(inRouter(<IdeaFeed />));
    expect(screen.getByText("No ideas match what's selected.")).toBeInTheDocument();
  });

  it("copes with an unknown persona, an order with no ideas and an anchor missing its address", () => {
    const sparse = { ...MOCK_CUSTOMER_IDEAS[0], persona_id: "ghost", anchor: { ...MOCK_CUSTOMER_IDEAS[0].anchor!, descriptor: null, address: null, borough: null } };
    setIdeas({ data: [sparse] });
    mockedPersonas.mockReturnValue({ data: undefined } as ReturnType<typeof useCustomerPersonas>);
    const { unmount } = render(inRouter(<IdeaFeed />));
    expect(screen.getByRole("button", { name: "ghost" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Order · address unknown" })).toBeInTheDocument();
    unmount();
    render(inRouter(<IdeaFeed />, "/residents?order=NOWHERE"));
    expect(screen.getByText("Ideas about one order")).toBeInTheDocument();
  });

  it("labels an order whose ideas lack a descriptor and address", () => {
    const bare = { ...MOCK_CUSTOMER_IDEAS[0], anchor: { ...MOCK_CUSTOMER_IDEAS[0].anchor!, descriptor: null, address: null } };
    setIdeas({ data: [bare] });
    render(inRouter(<IdeaFeed />, `/residents?order=${bare.anchor.order_id}`));
    expect(screen.getByText("Ideas about order at an unknown address")).toBeInTheDocument();
  });
});
