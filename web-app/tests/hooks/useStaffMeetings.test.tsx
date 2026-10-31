import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useStaffMeetings } from "../../src/hooks/useStaffMeetings";
import { staffMeetingService } from "../../src/services/staffMeetingService";
import { MOCK_STAFF_MEETINGS } from "../../src/test-data/staffMeetings";

vi.mock("../../src/services/staffMeetingService", () => ({ staffMeetingService: { listMeetings: vi.fn() } }));

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>;
}

describe("useStaffMeetings", () => {
  it("unwraps the page into a list of meetings", async () => {
    vi.mocked(staffMeetingService.listMeetings).mockResolvedValue({ items: MOCK_STAFF_MEETINGS, nextCursor: null });
    const { result } = renderHook(() => useStaffMeetings(), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(MOCK_STAFF_MEETINGS));
  });
});
