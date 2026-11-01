import { useSearchParams } from "react-router-dom";

/*
 * What the Meet the Team page is focused on, in the URL so any view can
 * be linked: `?member=` (whose profile is open) and `?meeting=` (which
 * Staff Meeting is shown; the newest when unset).
 */
export interface TeamSelection {
  memberId: string | null;
  meetingId: string | null;
  selectMember: (memberId: string | null) => void;
  selectMeeting: (meetingId: string | null) => void;
}

export function useTeamSelection(): TeamSelection {
  const [params, setParams] = useSearchParams();
  const update = (key: "member" | "meeting", value: string | null): void => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    });
  };
  return {
    memberId: params.get("member"),
    meetingId: params.get("meeting"),
    selectMember: (memberId) => update("member", memberId),
    selectMeeting: (meetingId) => update("meeting", meetingId),
  };
}
