import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResidentDetailPanel } from "../../../src/components/customers/ResidentDetailPanel";
import { useCustomerPersonas } from "../../../src/hooks/useCustomerPersonas";
import { MOCK_CUSTOMER_PERSONAS } from "../../../src/test-data/customerPersonas";
import { inRouter } from "./customerFixtures";

vi.mock("../../../src/hooks/useCustomerPersonas", () => ({ useCustomerPersonas: vi.fn() }));
const mockedPersonas = vi.mocked(useCustomerPersonas);

function setPersonas(state: { data?: typeof MOCK_CUSTOMER_PERSONAS; isLoading?: boolean; error?: Error | null }) {
  mockedPersonas.mockReturnValue({ data: state.data, isLoading: state.isLoading ?? false, error: state.error ?? null } as ReturnType<typeof useCustomerPersonas>);
}

const IDEA_PATH = "/residents/sycamore/ideas/01K7IDEA0013";

beforeEach(() => {
  setPersonas({ data: MOCK_CUSTOMER_PERSONAS });
});

describe("ResidentDetailPanel", () => {
  it("shows the resident from the URL in full, with a link to all their ideas", () => {
    render(inRouter(<ResidentDetailPanel />, IDEA_PATH));
    expect(screen.getByRole("heading", { name: "Sycamore" })).toBeInTheDocument();
    expect(screen.getByText(/Drove the Q58/)).toBeInTheDocument();
    expect(screen.getAllByRole("meter")).toHaveLength(5);
    expect(screen.getByText("Persona prompt")).toBeInTheDocument();
    expect(screen.getByText(/4 ideas · last/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See all of Sycamore's ideas" })).toHaveAttribute("href", "/residents?persona=sycamore");
  });

  it("leaves out the last-idea time for a resident who has never had one", () => {
    setPersonas({ data: [{ ...MOCK_CUSTOMER_PERSONAS[1], idea_count: 0, last_idea_at: null }] });
    render(inRouter(<ResidentDetailPanel />, IDEA_PATH));
    expect(screen.getByText("0 ideas")).toBeInTheDocument();
  });

  it("shows loading, error and missing-resident states", () => {
    setPersonas({ isLoading: true });
    const { rerender } = render(inRouter(<ResidentDetailPanel />, IDEA_PATH));
    expect(screen.getByText("Loading resident…")).toBeInTheDocument();
    setPersonas({ error: new Error("HTTP 500") });
    rerender(inRouter(<ResidentDetailPanel />, IDEA_PATH));
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load resident: HTTP 500");
  });

  it("says when the resident in the URL no longer exists", () => {
    render(inRouter(<ResidentDetailPanel />, "/residents/nobody/ideas/x"));
    expect(screen.getByText("This resident no longer exists.")).toBeInTheDocument();
  });
});
