import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StaffMeetingSection } from "../../../src/components/team/StaffMeetingSection";
import { useStaffMeetings } from "../../../src/hooks/useStaffMeetings";
import type { StaffMeeting } from "../../../src/models/staffMeeting";
import { MOCK_STAFF_MEETINGS } from "../../../src/test-data/staffMeetings";
import { inRouter } from "./teamFixtures";

vi.mock("../../../src/hooks/useStaffMeetings", () => ({ useStaffMeetings: vi.fn() }));

function setMeetings(state: { data?: StaffMeeting[]; isLoading?: boolean; error?: Error | null }) {
  vi.mocked(useStaffMeetings).mockReturnValue({ data: state.data, isLoading: state.isLoading ?? false, error: state.error ?? null } as ReturnType<typeof useStaffMeetings>);
}

beforeEach(() => setMeetings({ data: MOCK_STAFF_MEETINGS }));

describe("StaffMeetingSection", () => {
  it("shows the latest meeting: scorecard, transcript, notes and action items", () => {
    render(inRouter(<StaffMeetingSection />));
    expect(screen.getByRole("button", { name: "Sat, Oct 31 · latest" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/18 min · reviewed the WBR for the week of Mon, Oct 26/)).toBeInTheDocument();
    const scorecard = screen.getByRole("list", { name: "Scorecard" });
    expect(within(scorecard).getAllByRole("listitem")).toHaveLength(7);
    expect(within(scorecard).getByText("$43.20")).toBeInTheDocument();
    expect(within(scorecard).getAllByLabelText("better than last meeting").length).toBeGreaterThan(0);
    expect(within(scorecard).getAllByLabelText("worse than last meeting").length).toBeGreaterThan(0);
    const log = screen.getByRole("log", { name: "Transcript" });
    expect(within(log).getAllByRole("listitem")).toHaveLength(15);
    expect(screen.getByText("Notes by June Bleecker")).toBeInTheDocument();
    expect(screen.getByText("Batching stays the top engineering priority.")).toBeInTheDocument();
    const items = screen.getByRole("list", { name: "Action items" });
    expect(within(items).getAllByText("Carried from 2026-10-29")).toHaveLength(1);
    expect(within(items).getByRole("link", { name: "#112" })).toHaveAttribute("href", "https://github.com/seththeeke/nyc-311/issues/112");
    expect(within(items).getByText("Blocked")).toBeInTheDocument();
  });

  it("switches meetings through the URL", async () => {
    render(inRouter(<StaffMeetingSection />));
    await userEvent.setup().click(screen.getByRole("button", { name: "Thu, Oct 29" }));
    expect(screen.getByRole("status", { name: "search" })).toHaveTextContent("?meeting=SM-2026-10-29");
    expect(screen.getByText("Two drivers active from Oct 30. Brooklyn backlog 61 → 44.")).toBeInTheDocument();
    expect(within(screen.getByRole("log")).getByText("Seth Theeke")).toBeInTheDocument();
  });

  it("falls back to the latest meeting for an unknown ?meeting=", () => {
    render(inRouter(<StaffMeetingSection />, "/team?meeting=SM-1999"));
    expect(screen.getByRole("button", { name: "Sat, Oct 31 · latest" })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows loading, error and empty states", () => {
    setMeetings({ isLoading: true });
    const { rerender } = render(inRouter(<StaffMeetingSection />));
    expect(screen.getByText("Loading meetings…")).toHaveAttribute("role", "status");
    setMeetings({ error: new Error("boom") });
    rerender(inRouter(<StaffMeetingSection />));
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load meetings: boom");
    setMeetings({ data: [] });
    rerender(inRouter(<StaffMeetingSection />));
    expect(screen.getByText("No meetings yet.")).toBeInTheDocument();
  });
});
