import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ResidentsSection } from "../../../src/components/marketing/ResidentsSection";
import { ResidentCrowd } from "../../../src/components/marketing/ResidentCrowd";
import { ResidentFlywheel } from "../../../src/components/marketing/ResidentFlywheel";
import { FLYWHEEL_STEPS } from "../../../src/components/marketing/marketingContent";
import { useResidentPersonas } from "../../../src/hooks/useResidentPersonas";
import { useResidentIdeas } from "../../../src/hooks/useResidentIdeas";
import { MOCK_RESIDENT_PERSONAS } from "../../../src/test-data/residentPersonas";
import { MOCK_RESIDENT_IDEAS } from "../../../src/test-data/residentIdeas";
import type { ResidentIdea } from "../../../src/models/residentIdea";

vi.mock("../../../src/hooks/useResidentPersonas", () => ({ useResidentPersonas: vi.fn() }));
vi.mock("../../../src/hooks/useResidentIdeas", () => ({ useResidentIdeas: vi.fn() }));
vi.mock("../../../src/hooks/useResidentAvatar", () => ({ useResidentAvatar: () => null }));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const personas = MOCK_RESIDENT_PERSONAS;
const ideas: ResidentIdea[] = [...MOCK_RESIDENT_IDEAS];

describe("ResidentCrowd", () => {
  it("shows every resident and cycles their latest ideas, ringing whoever is speaking", () => {
    vi.useFakeTimers();
    const { container } = render(<ResidentCrowd personas={personas} ideas={ideas} playing={true} />);
    for (const persona of personas) expect(screen.getAllByText(persona.name).length).toBeGreaterThan(0);
    const first = container.querySelector("blockquote")?.textContent;
    expect(first).toContain(ideas[0].text);
    const speaker = personas.find((p) => p.persona_id === ideas[0].persona_id);
    if (speaker) expect(screen.getAllByText(speaker.name).some((el) => el.className.includes("text-hue-rose"))).toBe(true);
    act(() => vi.advanceTimersByTime(4500));
    expect(container.querySelector("blockquote")?.textContent).toContain(ideas[1 % Math.min(ideas.length, 8)].text);
  });

  it("credits an unknown speaker as a resident, and shows no bubble without ideas", () => {
    const stranger = { ...ideas[0], persona_id: "nobody" };
    const { rerender } = render(<ResidentCrowd personas={personas} ideas={[stranger]} playing={false} />);
    expect(screen.getByText("A resident")).toBeInTheDocument();
    rerender(<ResidentCrowd personas={personas} ideas={[]} playing={false} />);
    expect(screen.queryByRole("figure")).not.toBeInTheDocument();
  });
});

describe("ResidentFlywheel", () => {
  it("lights one station at a time and sweeps the comet forward", () => {
    vi.useFakeTimers();
    render(<ResidentFlywheel playing={true} />);
    const stations = screen.getAllByRole("listitem");
    expect(stations).toHaveLength(FLYWHEEL_STEPS.length);
    expect(stations[0]).toHaveAttribute("aria-current", "step");
    expect(screen.getByText(FLYWHEEL_STEPS[0].body)).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(2600));
    expect(screen.getAllByRole("listitem")[1]).toHaveAttribute("aria-current", "step");
    expect(screen.getByTestId("flywheel-comet").style.transform).toBe("rotate(72deg)");
  });
});

describe("ResidentsSection", () => {
  it("joins the live residents and ideas to the flywheel, with a way to meet them", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    vi.mocked(useResidentPersonas).mockReturnValue({ data: personas } as ReturnType<typeof useResidentPersonas>);
    vi.mocked(useResidentIdeas).mockReturnValue({ data: ideas } as ReturnType<typeof useResidentIdeas>);
    render(
      <MemoryRouter>
        <ResidentsSection reducedMotion={true} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { level: 2, name: "New Yorkers who always need something." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Meet the residents/ })).toHaveAttribute("href", "/residents");
    expect(useResidentIdeas).toHaveBeenCalledWith(null);
  });

  it("renders before the API answers", () => {
    vi.mocked(useResidentPersonas).mockReturnValue({ data: undefined } as ReturnType<typeof useResidentPersonas>);
    vi.mocked(useResidentIdeas).mockReturnValue({ data: undefined } as ReturnType<typeof useResidentIdeas>);
    render(
      <MemoryRouter>
        <ResidentsSection reducedMotion={false} />
      </MemoryRouter>,
    );
    expect(screen.getByText("Flywheel")).toBeInTheDocument();
  });
});
