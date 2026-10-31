import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { StaffMeeting } from "../models/staffMeeting";
import { staffMeetingService } from "../services/staffMeetingService";

export const STAFF_MEETINGS_QUERY_KEY = ["staffMeetings"] as const;

/** Every published Staff Meeting, newest first. Components call this, never the service (CLAUDE.md §5.1). */
export function useStaffMeetings(): UseQueryResult<StaffMeeting[], Error> {
  return useQuery({
    queryKey: STAFF_MEETINGS_QUERY_KEY,
    queryFn: async () => (await staffMeetingService.listMeetings()).items,
  });
}
