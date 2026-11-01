import { useSearchParams } from "react-router-dom";

/*
 * What the Meet the Team page is focused on, in the URL so any view can
 * be linked: `?member=` (whose profile is open) and `?channel=` (which
 * Team Chat channel is open; #executive-team when unset) `?thread=`
 * and `?contributions=`.
 */
export interface TeamSelection {
  memberId: string | null;
  channelId: string | null;
  selectMember: (memberId: string | null) => void;
  /* The Team Chat thread open in the secondary workspace. */
  threadId: string | null;
  /* Whose contributions are open in the secondary workspace on Meet the Team. */
  contributionsId: string | null;
  selectChannel: (channelId: string | null) => void;
  selectThread: (threadId: string | null) => void;
  selectContributions: (memberId: string | null) => void;
}

export function useTeamSelection(): TeamSelection {
  const [params, setParams] = useSearchParams();
  /* A new channel closes any open thread: threads belong to their channel. */
  const update = (key: "member" | "channel" | "thread" | "contributions", value: string | null): void => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(key, value);
      else next.delete(key);
      if (key === "channel") next.delete("thread");
      return next;
    });
  };
  return {
    memberId: params.get("member"),
    channelId: params.get("channel"),
    selectMember: (memberId) => update("member", memberId),
    threadId: params.get("thread"),
    selectChannel: (channelId) => update("channel", channelId),
    selectThread: (threadId) => update("thread", threadId),
    contributionsId: params.get("contributions"),
    selectContributions: (memberId) => update("contributions", memberId),
  };
}
