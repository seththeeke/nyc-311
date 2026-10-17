import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AboutOverlay } from "../../../src/components/about/AboutOverlay";
import { ABOUT_SECTIONS, resolveAboutSections } from "../../../src/components/about/aboutSections";
import { useFeatureEnabled } from "../../../src/hooks/useFeatureTreatment";
/* The LLMs write-up is gated on the Residents flag; off unless a test turns it on. */
vi.mock("../../../src/hooks/useFeatureTreatment", () => ({
  useFeatureEnabled: vi.fn(() => false),
  useFeatureTreatment: vi.fn(() => ({ treatment: null, isLoading: false })),
}));

describe("AboutOverlay", () => {
  it("renders as a non-modal drawer dialog titled About BoroughSim, docked right at ~40% width", () => {
    render(<AboutOverlay onClose={vi.fn()} />);

    const dialog = screen.getByRole("dialog", { name: "About BoroughSim" });
    expect(dialog).not.toHaveAttribute("aria-modal");
    expect(dialog).toHaveClass("right-0", "md:w-[40vw]");
    expect(dialog).not.toHaveClass("inset-0");
  });

  it("always shows the overview as plain text, not an accordion", () => {
    render(<AboutOverlay onClose={vi.fn()} />);

    expect(screen.getByText(/ingests real NYC 311/)).toBeVisible();
    expect(screen.queryByRole("button", { name: /^Overview/ })).not.toBeInTheDocument();
  });

  it("renders every other section collapsed, with title and one-liner", () => {
    render(<AboutOverlay onClose={vi.fn()} />);

    for (const section of ABOUT_SECTIONS) {
      const button = screen.getByRole("button", { name: new RegExp(`^${section.title}`) });
      expect(button).toHaveAttribute("aria-expanded", "false");
    }
    expect(screen.getByText("Powers the public API and the admin routes.")).toBeInTheDocument();
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("expands a section to reveal its full content, and collapses it again", async () => {
    render(<AboutOverlay onClose={vi.fn()} />);
    const user = userEvent.setup();
    const webServices = screen.getByRole("button", { name: /^Web Services/ });

    await user.click(webServices);
    expect(webServices).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("region", { name: /Web Services/ })).toHaveTextContent(/API Gateway/);

    await user.click(webServices);
    expect(webServices).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("lets several sections be open at once", async () => {
    render(<AboutOverlay onClose={vi.fn()} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /^Web Services/ }));
    await user.click(screen.getByRole("button", { name: /^Frontend/ }));

    expect(screen.getAllByRole("region")).toHaveLength(2);
  });

  it("marks in-progress sections with a Work In Progress badge, even while collapsed", () => {
    render(<AboutOverlay onClose={vi.fn()} />);

    const inProgress = ABOUT_SECTIONS.filter((s) => s.status === "IN_PROGRESS");
    expect(inProgress.length).toBeGreaterThan(0);
    expect(screen.getAllByText("Work In Progress")).toHaveLength(inProgress.length);
    expect(screen.getByRole("button", { name: /^LLMs.*Work In Progress/ })).toBeInTheDocument();
  });

  it("shows a placeholder line and no tags inside an expanded in-progress section", async () => {
    render(<AboutOverlay onClose={vi.fn()} />);

    await userEvent.setup().click(screen.getByRole("button", { name: /^LLMs/ }));

    expect(screen.getByRole("region", { name: /LLMs/ })).toHaveTextContent(/Work in progress/);
    expect(screen.queryByRole("list", { name: "LLMs concepts" })).not.toBeInTheDocument();
  });

  it("shows concept tags under an expanded section's paragraph", async () => {
    render(<AboutOverlay onClose={vi.fn()} />);

    await userEvent.setup().click(screen.getByRole("button", { name: /^Data Ingestion/ }));

    const tags = screen.getByRole("list", { name: "Data Ingestion concepts" });
    expect(tags).toHaveTextContent("EventBridge Scheduler");
    expect(tags.querySelectorAll("li").length).toBeGreaterThan(1);
  });

  it("lists sections in data-flow order, ingestion first and frontend last", () => {
    render(<AboutOverlay onClose={vi.fn()} />);

    const headings = screen.getAllByRole("heading", { level: 2 });
    expect(headings).toHaveLength(ABOUT_SECTIONS.length);
    ABOUT_SECTIONS.forEach((section, index) => expect(headings[index]).toHaveTextContent(section.title));
    expect(ABOUT_SECTIONS[0]?.id).toBe("data-ingestion");
    expect(ABOUT_SECTIONS[ABOUT_SECTIONS.length - 1]?.id).toBe("frontend");
  });

  it("focuses the close button on open", () => {
    render(<AboutOverlay onClose={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Close About" })).toHaveFocus();
  });

  it("calls onClose from the close button", async () => {
    const onClose = vi.fn();
    render(<AboutOverlay onClose={onClose} />);

    await userEvent.setup().click(screen.getByRole("button", { name: "Close About" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose on Escape and ignores other keys", async () => {
    const onClose = vi.fn();
    render(<AboutOverlay onClose={onClose} />);
    const user = userEvent.setup();

    await user.keyboard("a");
    expect(onClose).not.toHaveBeenCalled();

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("restores focus to the opener on unmount", () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();

    const { unmount } = render(<AboutOverlay onClose={vi.fn()} />);
    unmount();

    expect(opener).toHaveFocus();
    opener.remove();
  });

  it("does not try to restore focus when nothing element-like was focused", () => {
    const spy = vi.spyOn(document, "activeElement", "get").mockReturnValue(null);
    const { unmount } = render(<AboutOverlay onClose={vi.fn()} />);

    expect(() => unmount()).not.toThrow();
    spy.mockRestore();
  });
});

describe("AboutOverlay — LLMs write-up behind the Residents flag", () => {
  it("shows LLMs as work in progress while CUSTOMERS_TAB is off", async () => {
    render(<AboutOverlay onClose={vi.fn()} />);
    const llms = screen.getByRole("button", { name: /^LLMs/ });
    expect(llms).toHaveTextContent("Work In Progress");
    expect(useFeatureEnabled).toHaveBeenCalledWith("CUSTOMERS_TAB", "T1");
  });

  it("shows the launched write-up, with no badge, once CUSTOMERS_TAB is on", async () => {
    vi.mocked(useFeatureEnabled).mockReturnValue(true);
    const user = userEvent.setup();
    render(<AboutOverlay onClose={vi.fn()} />);
    const llms = screen.getByRole("button", { name: /^LLMs/ });
    expect(llms).not.toHaveTextContent("Work In Progress");
    expect(llms).toHaveTextContent("Gives the simulated residents their voice.");
    await user.click(llms);
    expect(screen.getByText(/low-cost model on Amazon Bedrock/)).toBeVisible();
    expect(screen.getByRole("list", { name: "LLMs concepts" })).toHaveTextContent("Persona prompts");
    vi.mocked(useFeatureEnabled).mockReturnValue(false);
  });
});

describe("resolveAboutSections", () => {
  it("swaps a flagged section only when its own flag and treatment are on", () => {
    const llms = ABOUT_SECTIONS.find((section) => section.id === "llms")!;
    const on = resolveAboutSections(ABOUT_SECTIONS, (key, treatment) => key === "CUSTOMERS_TAB" && treatment === "T1");
    expect(on.find((section) => section.id === "llms")).toBe(llms.whenFlagOn?.section);
    expect(on.filter((section, index) => section !== ABOUT_SECTIONS[index])).toHaveLength(1);
    const off = resolveAboutSections(ABOUT_SECTIONS, () => false);
    expect(off).toEqual(ABOUT_SECTIONS);
  });

  it("never mentions the old name for the system in the launched write-up", () => {
    const launched = ABOUT_SECTIONS.find((section) => section.id === "llms")!.whenFlagOn!.section;
    expect(JSON.stringify(launched).toLowerCase()).not.toContain("bureau");
  });
});
