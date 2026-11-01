import type { ReactElement } from "react";
import { useTeamSelection } from "../../../hooks/useTeamSelection";
import { MemberProfilePanel } from "./MemberProfilePanel";
import { ThreadPanel } from "./ThreadPanel";

/** Team Chat's secondary workspace: a member's profile when one is open, otherwise the thread (docs/17-executive-team.md §5). */
export function ChatSidePanel(): ReactElement {
  const { profileId } = useTeamSelection();
  return profileId ? <MemberProfilePanel memberId={profileId} /> : <ThreadPanel />;
}
