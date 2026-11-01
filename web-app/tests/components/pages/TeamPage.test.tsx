import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TeamPage } from "../../../src/components/pages/TeamPage";
import { useStaffMeetings } from "../../../src/hooks/useStaffMeetings";
import { MOCK_STAFF_MEETINGS } from "../../../src/test-data/staffMeetings";
import { inRouter } from "../team/teamFixtures";

vi.mock("../../../src/hooks/useStaffMeetings", () => ({ useStaffMeetings: vi.fn() }));
vi.mocked(useStaffMeetings).mockReturnValue({ data: MOCK_STAFF_MEETINGS, isLoading: false, error: null } as ReturnType<typeof useStaffMeetings>);

describe("TeamPage", () => {
  it("shows the goal until someone is picked, then their profile, and back", async () => {
    const user = userEvent.setup();
    render(inRouter(<TeamPage />));
    expect(screen.getByRole("heading", { level: 1, name: "Meet the Team" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "The goal" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Staff Meeting" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Celestine Vey/ }));
    expect(screen.getByRole("status", { name: "search" })).toHaveTextContent("?member=cpo");
    expect(screen.getByRole("region", { name: "Celestine Vey" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close profile" }));
    expect(screen.getByRole("region", { name: "The goal" })).toBeInTheDocument();
  });
});
