import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PersonaPanel } from "../../../src/components/customers/PersonaPanel";
import { useCustomerPersonas } from "../../../src/hooks/useCustomerPersonas";
import { MOCK_CUSTOMER_PERSONAS } from "../../../src/test-data/customerPersonas";
import { inRouter } from "./customerFixtures";

vi.mock("../../../src/hooks/useCustomerPersonas", () => ({ useCustomerPersonas: vi.fn() }));
const mockedPersonas = vi.mocked(useCustomerPersonas);

function setPersonas(state: { data?: typeof MOCK_CUSTOMER_PERSONAS; isLoading?: boolean; error?: Error | null }) {
  mockedPersonas.mockReturnValue({ data: state.data, isLoading: state.isLoading ?? false, error: state.error ?? null } as ReturnType<typeof useCustomerPersonas>);
}

beforeEach(() => {
  setPersonas({ data: MOCK_CUSTOMER_PERSONAS });
});

describe("PersonaPanel", () => {
  it("lists every resident with dials, idea count and active hours, and no status", () => {
    render(inRouter(<PersonaPanel />));
    expect(screen.getByRole("heading", { name: "Residents" })).toBeInTheDocument();
    const cards = screen.getAllByRole("button", { pressed: false });
    expect(cards).toHaveLength(3);
    const juniper = screen.getByRole("button", { name: /Juniper/ });
    expect(juniper).not.toHaveTextContent(/ACTIVE|PAUSED/);
    expect(within(juniper).getByText("21:00–05:00")).toBeInTheDocument();
    expect(within(juniper).getByRole("meter", { name: "Patience 50 out of 100" })).toBeInTheDocument();
    expect(within(screen.getByRole("button", { name: /Hawthorn/ })).getByText(/6 ideas · last/)).toBeInTheDocument();
  });

  it("selects a persona, deselects it on a second press, and clears with Show everyone", async () => {
    const user = userEvent.setup();
    render(inRouter(<PersonaPanel />));
    await user.click(screen.getByRole("button", { name: /Sycamore/ }));
    expect(screen.getByRole("status", { name: "search" })).toHaveTextContent("?persona=sycamore");
    expect(screen.getByRole("button", { name: /Sycamore/ })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: /Sycamore/ }));
    expect(screen.getByRole("status", { name: "search" })).toBeEmptyDOMElement();

    await user.click(screen.getByRole("button", { name: /Juniper/ }));
    await user.click(screen.getByRole("button", { name: "Show everyone" }));
    expect(screen.getByRole("status", { name: "search" })).toBeEmptyDOMElement();
  });

  it("shows loading, error and empty states", () => {
    setPersonas({ isLoading: true });
    const { rerender } = render(inRouter(<PersonaPanel />));
    expect(screen.getByRole("status", { name: "" })).toHaveTextContent("Loading residents…");

    setPersonas({ error: new Error("HTTP 404") });
    rerender(inRouter(<PersonaPanel />));
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load residents: HTTP 404");

    setPersonas({ data: [] });
    rerender(inRouter(<PersonaPanel />));
    expect(screen.getByText("No residents yet.")).toBeInTheDocument();
  });

  it("omits the last-idea time for a persona who has never had one", () => {
    setPersonas({ data: [{ ...MOCK_CUSTOMER_PERSONAS[0], idea_count: 0, last_idea_at: null }] });
    render(inRouter(<PersonaPanel />));
    expect(screen.getByText("0 ideas")).toBeInTheDocument();
  });
});
