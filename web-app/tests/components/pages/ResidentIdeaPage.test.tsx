import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ResidentIdeaPage } from "../../../src/components/pages/ResidentIdeaPage";
import { useCustomerIdea } from "../../../src/hooks/useCustomerIdea";
import { useCustomerIdeas } from "../../../src/hooks/useCustomerIdeas";
import { useCustomerPersonas } from "../../../src/hooks/useCustomerPersonas";
import type { CustomerIdea } from "../../../src/models/customerIdea";
import { MOCK_CUSTOMER_IDEAS } from "../../../src/test-data/customerIdeas";
import { MOCK_CUSTOMER_PERSONAS } from "../../../src/test-data/customerPersonas";

vi.mock("../../../src/hooks/useCustomerIdea", () => ({ useCustomerIdea: vi.fn() }));
vi.mock("../../../src/hooks/useCustomerIdeas", () => ({ useCustomerIdeas: vi.fn() }));
vi.mock("../../../src/hooks/useCustomerPersonas", () => ({ useCustomerPersonas: vi.fn() }));

const ATLANTIC_ESCALATION = MOCK_CUSTOMER_IDEAS.find((idea) => idea.idea_id === "01K7IDEA0014")!;
const FEATURE_REQUEST = MOCK_CUSTOMER_IDEAS.find((idea) => idea.idea_id === "01K7IDEA0011")!;

function setIdea(state: { data?: CustomerIdea; isLoading?: boolean; error?: Error | null }) {
  vi.mocked(useCustomerIdea).mockReturnValue({ data: state.data, isLoading: state.isLoading ?? false, error: state.error ?? null } as ReturnType<typeof useCustomerIdea>);
}

function renderAt(personaId: string, ideaId: string) {
  render(
    <MemoryRouter initialEntries={[`/residents/${personaId}/ideas/${ideaId}`]}>
      <Routes>
        <Route path="/residents/:personaId/ideas/:ideaId" element={<ResidentIdeaPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(useCustomerIdeas).mockReturnValue({ data: MOCK_CUSTOMER_IDEAS } as ReturnType<typeof useCustomerIdeas>);
  vi.mocked(useCustomerPersonas).mockReturnValue({ data: MOCK_CUSTOMER_PERSONAS } as ReturnType<typeof useCustomerPersonas>);
  setIdea({ data: ATLANTIC_ESCALATION });
});

describe("ResidentIdeaPage", () => {
  it("shows the idea in full: who, what kind of need, the text, the order and how it was generated", () => {
    renderAt("hawthorn", "01K7IDEA0014");
    expect(useCustomerIdea).toHaveBeenCalledWith("hawthorn", "01K7IDEA0014");
    expect(screen.getByRole("heading", { level: 1, name: "Idea Detail" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "← All ideas" })).toHaveAttribute("href", "/residents");
    expect(screen.getByRole("link", { name: "Hawthorn" })).toHaveAttribute("href", "/residents?persona=hawthorn");
    expect(screen.getByText("· Escalation")).toBeInTheDocument();
    expect(screen.getByText(/The van bottomed out again/)).toBeInTheDocument();
    const order = screen.getByRole("region", { name: "The order" });
    expect(within(order).getByText("412 ATLANTIC AVENUE")).toBeInTheDocument();
    expect(within(order).getByText("Brooklyn")).toBeInTheDocument();
    expect(within(order).getByText("#69860415")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "What they did" })).toHaveTextContent("Nothing yet.");
    const generated = screen.getByRole("region", { name: "How it was generated" });
    expect(within(generated).getByText("amazon.nova-micro-v1:0")).toBeInTheDocument();
    expect(within(generated).getByText("412 in · 74 out")).toBeInTheDocument();
  });

  it("links every other idea about the same order to its own detail view", () => {
    renderAt("hawthorn", "01K7IDEA0014");
    const related = screen.getByRole("region", { name: "Other ideas about this order" });
    const links = within(related).getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "/residents/hawthorn/ideas/01K7IDEA0010");
  });

  it("says when no one else has had an idea about the order yet", () => {
    vi.mocked(useCustomerIdeas).mockReturnValue({ data: undefined } as ReturnType<typeof useCustomerIdeas>);
    renderAt("hawthorn", "01K7IDEA0014");
    expect(within(screen.getByRole("region", { name: "Other ideas about this order" })).getByText("None yet.")).toBeInTheDocument();
  });

  it("explains an idea about the service itself, with no order or related ideas", () => {
    setIdea({ data: FEATURE_REQUEST });
    renderAt("juniper", "01K7IDEA0011");
    expect(screen.getByRole("region", { name: "What they did" })).toHaveTextContent("Text alerts when a crew is on my street");
    expect(within(screen.getByRole("region", { name: "The order" })).getByText("The service itself, not an order")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Other ideas about this order" })).not.toBeInTheDocument();
  });

  it("marks unknown order fields, and falls back to the resident id when their name is unknown", () => {
    setIdea({ data: { ...ATLANTIC_ESCALATION, anchor: { ...ATLANTIC_ESCALATION.anchor!, descriptor: null, address: null, borough: null } } });
    vi.mocked(useCustomerPersonas).mockReturnValue({ data: undefined } as ReturnType<typeof useCustomerPersonas>);
    renderAt("hawthorn", "01K7IDEA0014");
    expect(within(screen.getByRole("region", { name: "The order" })).getAllByText("Unknown")).toHaveLength(3);
    expect(screen.getByRole("link", { name: "hawthorn" })).toBeInTheDocument();
  });

  it("shows loading and error states", () => {
    setIdea({ isLoading: true });
    const { unmount } = render(
      <MemoryRouter initialEntries={["/residents/hawthorn/ideas/x"]}>
        <Routes>
          <Route path="/residents/:personaId/ideas/:ideaId" element={<ResidentIdeaPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("Loading idea…")).toBeInTheDocument();
    unmount();
    setIdea({ error: new Error("HTTP 404") });
    renderAt("hawthorn", "x");
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load this idea: HTTP 404");
  });

  it("copes with being rendered outside its route", () => {
    render(
      <MemoryRouter>
        <ResidentIdeaPage />
      </MemoryRouter>,
    );
    expect(useCustomerIdea).toHaveBeenLastCalledWith("", "");
  });
});
