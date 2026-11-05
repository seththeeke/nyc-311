import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { KineticHeadline } from "../../../src/components/marketing/KineticHeadline";
import { EnterFleetButton } from "../../../src/components/marketing/EnterFleetButton";
import { AgentOrbit, EXECUTIVES, orbitAngle } from "../../../src/components/marketing/AgentOrbit";
import { FinalCta } from "../../../src/components/marketing/FinalCta";
import { Reveal } from "../../../src/components/marketing/Reveal";
import { MarketingHero } from "../../../src/components/marketing/MarketingHero";
import { TEAM_ROSTER } from "../../../src/components/team/teamRoster";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { useFeatureEnabled } from "../../../src/hooks/useFeatureTreatment";

vi.mock("../../../src/hooks/useFeatureTreatment", () => ({ useFeatureEnabled: vi.fn(() => true) }));

function withQuery(ui: ReactElement): ReactElement {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>;
}

describe("KineticHeadline", () => {
  it("names the whole sentence once and staggers each word", () => {
    render(<KineticHeadline />);
    expect(screen.getByRole("heading", { level: 1, name: "New York reports it. BoroughSim fixes it." })).toBeInTheDocument();
    const words = screen.getByRole("heading").querySelectorAll("span[style]");
    expect(words).toHaveLength(7);
    expect((words[6] as HTMLElement).style.animationDelay).toBe(`${6 * 90 + 260}ms`);
  });
});

describe("EnterFleetButton", () => {
  it("enters on click and leans toward the pointer, settling when it leaves", async () => {
    const onEnter = vi.fn();
    render(<EnterFleetButton onEnter={onEnter} size="LG" />);
    const button = screen.getByRole("button", { name: /Enter fleet/ });
    button.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 40 }) as DOMRect;
    fireEvent.pointerMove(button, { clientX: 100, clientY: 40 });
    expect(button.style.transform).toBe("translate(15px, 6px) scale(1)");
    fireEvent.pointerLeave(button);
    expect(button.style.transform).toBe("translate(0px, 0px) scale(1)");
    await userEvent.click(button);
    expect(onEnter).toHaveBeenCalledTimes(1);
  });
});

describe("EnterFleetButton auto-select", () => {
  it("selects itself after the delay, offers Enter, and lets go on blur", () => {
    vi.useFakeTimers();
    render(<EnterFleetButton onEnter={vi.fn()} autoSelectDelayMs={500} />);
    const button = screen.getByRole("button", { name: /Enter fleet/ });
    expect(button).not.toHaveFocus();
    act(() => vi.advanceTimersByTime(500));
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute("data-selected", "true");
    expect(screen.getByText("Enter ↵")).toBeInTheDocument();
    act(() => button.blur());
    expect(button).toHaveAttribute("data-selected", "false");
    vi.useRealTimers();
  });

  it("leaves focus alone if the visitor has already focused something", () => {
    vi.useFakeTimers();
    render(
      <>
        <input aria-label="elsewhere" />
        <EnterFleetButton onEnter={vi.fn()} autoSelectDelayMs={100} />
      </>,
    );
    act(() => screen.getByLabelText("elsewhere").focus());
    act(() => vi.advanceTimersByTime(100));
    expect(screen.getByLabelText("elsewhere")).toHaveFocus();
    vi.useRealTimers();
  });
});

describe("AgentOrbit", () => {
  it("spaces members evenly from 12 o'clock", () => {
    expect(orbitAngle(0, 4)).toBe(-90);
    expect(orbitAngle(1, 4)).toBe(0);
    expect(orbitAngle(0, 0)).toBe(-90);
  });

  it("puts only the executives on the ring, with their faces, and counts the agents", () => {
    render(
      <MemoryRouter>
        <AgentOrbit />
      </MemoryRouter>,
    );
    expect(EXECUTIVES.some((m) => m.role === "ENGINEER")).toBe(false);
    for (const member of EXECUTIVES) expect(screen.getByText(member.name)).toBeInTheDocument();
    for (const engineer of TEAM_ROSTER.filter((m) => m.role === "ENGINEER")) expect(screen.queryByText(engineer.name)).not.toBeInTheDocument();
    const agents = EXECUTIVES.filter((m) => m.kind === "AGENT").length;
    expect(screen.getByText(`1 + ${agents}`)).toBeInTheDocument();
    const photos = EXECUTIVES.filter((m) => m.photo_url).length;
    expect(document.querySelectorAll("li img")).toHaveLength(photos);
  });

  it("links to the team page while Meet the Team is on", async () => {
    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<AgentOrbit />} />
          <Route path="/team" element={<p>Team page</p>} />
        </Routes>
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole("link", { name: /Meet the Team/ }));
    expect(screen.getByText("Team page")).toBeInTheDocument();
  });

  it("hides the link while Meet the Team is off", () => {
    vi.mocked(useFeatureEnabled).mockReturnValueOnce(false);
    render(
      <MemoryRouter>
        <AgentOrbit />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("link", { name: /Meet the Team/ })).not.toBeInTheDocument();
  });
});

describe("FinalCta and Reveal", () => {
  it("closes on a large Enter fleet", async () => {
    const onEnter = vi.fn();
    render(<FinalCta onEnter={onEnter} />);
    await userEvent.click(screen.getByRole("button", { name: /Enter fleet/ }));
    expect(onEnter).toHaveBeenCalled();
  });

  it("starts hidden until it scrolls into view", () => {
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe = vi.fn();
        disconnect = vi.fn();
      },
    );
    render(<Reveal delayMs={120}>hello</Reveal>);
    const box = screen.getByText("hello");
    expect(box).toHaveAttribute("data-revealed", "false");
    expect(box.style.transitionDelay).toBe("120ms");
    vi.unstubAllGlobals();
  });
});

describe("MarketingHero", () => {
  it("shows the headline, the simulation subhead and both ways in", async () => {
    const onEnter = vi.fn();
    render(withQuery(<MarketingHero onEnter={onEnter} reducedMotion={true} theme="DARK" />));
    expect(screen.getByText(/BoroughSim is a simulation/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See how it works" })).toHaveAttribute("href", "#how-it-works");
    expect(screen.getByTestId("city-pulse")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Enter fleet/ }));
    expect(onEnter).toHaveBeenCalled();
  });
});
