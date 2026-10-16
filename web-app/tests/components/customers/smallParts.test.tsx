import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PersonaAvatar } from "../../../src/components/customers/PersonaAvatar";
import { DemeanorBars } from "../../../src/components/customers/DemeanorBars";
import { MOCK_CUSTOMER_PERSONAS } from "../../../src/test-data/customerPersonas";

describe("PersonaAvatar", () => {
  it("shows the initial on a neutral background, decoratively, in either size", () => {
    const { container, rerender } = render(<PersonaAvatar name="Hawthorn" />);
    expect(container.firstChild).toHaveTextContent("H");
    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
    expect(container.firstChild).toHaveClass("h-8", "bg-panel-strong");
    rerender(<PersonaAvatar name="Hawthorn" size="LG" />);
    expect(container.firstChild).toHaveClass("h-12");
  });
});

describe("DemeanorBars", () => {
  it("shows the three demeanor dials, and activity and follow-up when detailed", () => {
    const { rerender } = render(<DemeanorBars persona={MOCK_CUSTOMER_PERSONAS[0]} />);
    expect(screen.getAllByRole("meter")).toHaveLength(3);
    expect(screen.getByRole("meter", { name: "Hostility 70 out of 100" })).toHaveAttribute("aria-valuenow", "70");
    rerender(<DemeanorBars persona={MOCK_CUSTOMER_PERSONAS[0]} detailed />);
    expect(screen.getAllByRole("meter")).toHaveLength(5);
    expect(screen.getByRole("meter", { name: "Follow-up 60 out of 100" })).toBeInTheDocument();
  });
});

describe("PersonaSpotlight", () => {
  it("says a persona with no borough interests follows anywhere", async () => {
    const { PersonaSpotlight } = await import("../../../src/components/customers/PersonaSpotlight");
    render(<PersonaSpotlight persona={{ ...MOCK_CUSTOMER_PERSONAS[0], interests: { boroughs: [] } }} onClose={() => undefined} />);
    expect(screen.getByText("Anywhere")).toBeInTheDocument();
  });
});
