import type { ReactElement } from "react";
import { CEO_ID, memberById } from "../teamRoster";
import type { Reaction } from "./chatChannels";

/** The emoji pills under a message, each naming who reacted. Read-only: the web app doesn't react yet (§10.8). */
export function ReactionBar({ reactions }: { reactions: readonly Reaction[] }): ReactElement | null {
  if (!reactions.length) return null;
  return (
    <ul aria-label="Reactions" className="mt-1 flex flex-wrap items-center gap-1">
      {reactions.map((reaction) => {
        const mine = reaction.member_ids.includes(CEO_ID);
        const names = reaction.member_ids.map((id) => memberById(id)?.name ?? id).join(", ");
        return (
          <li
            key={reaction.emoji}
            aria-label={`${reaction.emoji} ${reaction.member_ids.length}: ${names}`}
            title={names}
            className={`rounded-full border px-1.5 text-xs ${mine ? "border-indigo-400/60 bg-indigo-500/15 text-fg" : "border-line bg-panel text-fg-muted"}`}
          >
            {reaction.emoji} {reaction.member_ids.length}
          </li>
        );
      })}
    </ul>
  );
}
