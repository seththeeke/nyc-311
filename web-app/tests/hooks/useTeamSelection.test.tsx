import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useTeamSelection } from "../../src/hooks/useTeamSelection";

function wrapperAt(path: string) {
  return ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>;
}

describe("useTeamSelection", () => {
  it("reads and writes ?member= and ?meeting= independently", () => {
    const { result } = renderHook(() => useTeamSelection(), { wrapper: wrapperAt("/team?member=cto") });
    expect(result.current).toMatchObject({ memberId: "cto", meetingId: null });
    act(() => result.current.selectMeeting("SM-2026-10-30"));
    expect(result.current).toMatchObject({ memberId: "cto", meetingId: "SM-2026-10-30" });
    act(() => result.current.selectMember(null));
    expect(result.current).toMatchObject({ memberId: null, meetingId: "SM-2026-10-30" });
    act(() => result.current.selectMember("cfo"));
    expect(result.current.memberId).toBe("cfo");
  });
});
