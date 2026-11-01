import { type ReactElement, useState } from "react";
import { CEO_ID, memberById } from "../teamRoster";
import type { Reaction } from "./chatChannels";

/* The quick picker: a short, team-flavoured set rather than a full emoji keyboard. */
export const PICKER = ["👍", "✅", "🎉", "🚀", "👀", "💰"] as const;

/** Reactions a viewer can toggle on a message, kept in the page for this demo. Reacting is always as the CEO. */
export function useReactions(initial: readonly Reaction[] = []): [readonly Reaction[], (emoji: string) => void] {
  const [reactions, setReactions] = useState(initial);
  const toggle = (emoji: string): void =>
    setReactions((current) => {
      const found = current.find((reaction) => reaction.emoji === emoji);
      if (!found) return [...current, { emoji, member_ids: [CEO_ID] }];
      const mine = found.member_ids.includes(CEO_ID);
      const member_ids = mine ? found.member_ids.filter((id) => id !== CEO_ID) : [...found.member_ids, CEO_ID];
      return current.flatMap((reaction) => (reaction !== found ? [reaction] : member_ids.length ? [{ emoji, member_ids }] : []));
    });
  return [reactions, toggle];
}

interface ReactionBarProps {
  reactions: readonly Reaction[];
  onToggle: (emoji: string) => void;
  picking: boolean;
}

/** The emoji pills under a message, and the picker when it's open. */
export function ReactionBar({ reactions, onToggle, picking }: ReactionBarProps): ReactElement | null {
  if (!reactions.length && !picking) return null;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {reactions.map((reaction) => {
        const mine = reaction.member_ids.includes(CEO_ID);
        const names = reaction.member_ids.map((id) => memberById(id)?.name ?? id).join(", ");
        return (
          <button
            key={reaction.emoji}
            type="button"
            onClick={() => onToggle(reaction.emoji)}
            aria-pressed={mine}
            aria-label={`${reaction.emoji} ${reaction.member_ids.length}: ${names}`}
            title={names}
            className={`rounded-full border px-1.5 text-xs ${mine ? "border-indigo-400/60 bg-indigo-500/15 text-fg" : "border-line bg-panel text-fg-muted hover:border-fg-subtle"}`}
          >
            {reaction.emoji} {reaction.member_ids.length}
          </button>
        );
      })}
      {picking && (
        <span role="group" aria-label="Pick a reaction" className="flex gap-0.5 rounded-full border border-line bg-popover px-1 shadow-sm">
          {PICKER.map((emoji) => (
            <button key={emoji} type="button" onClick={() => onToggle(emoji)} aria-label={`React ${emoji}`} className="rounded-full px-1 hover:bg-panel-hover">
              {emoji}
            </button>
          ))}
        </span>
      )}
    </div>
  );
}
