import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useTeamSelection } from "../../src/hooks/useTeamSelection";

function wrapperAt(path: string) {
  return ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>;
}

describe("useTeamSelection", () => {
  it("reads and writes ?member= and ?channel= independently", () => {
    const { result } = renderHook(() => useTeamSelection(), { wrapper: wrapperAt("/team?member=cto") });
    expect(result.current).toMatchObject({ memberId: "cto", channelId: null });
    act(() => result.current.selectChannel("tech-team"));
    expect(result.current).toMatchObject({ memberId: "cto", channelId: "tech-team" });
    act(() => result.current.selectMember(null));
    expect(result.current).toMatchObject({ memberId: null, channelId: "tech-team" });
    act(() => result.current.selectMember("cfo"));
    expect(result.current.memberId).toBe("cfo");
  });

  it("opens and closes a thread, and a new channel closes it", () => {
    const { result } = renderHook(() => useTeamSelection(), { wrapper: wrapperAt("/team/chat?channel=tech-team") });
    act(() => result.current.selectThread("T7"));
    expect(result.current).toMatchObject({ channelId: "tech-team", threadId: "T7" });
    act(() => result.current.selectThread(null));
    expect(result.current.threadId).toBeNull();
    act(() => result.current.selectThread("T4"));
    act(() => result.current.selectChannel("executive-team"));
    expect(result.current).toMatchObject({ channelId: "executive-team", threadId: null });
    act(() => result.current.selectContributions("coo"));
    expect(result.current.contributionsId).toBe("coo");
  });
});
