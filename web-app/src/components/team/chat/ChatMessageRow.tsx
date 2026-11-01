import type { ReactElement } from "react";
import type { TeamChatMessage } from "../../../models/teamChatMessage";
import { PersonaAvatar } from "../../residents/PersonaAvatar";
import { clockTime } from "../teamFormat";
import { memberById } from "../teamRoster";
import { reactionsOf, replyCount } from "./chatChannels";
import { MessageText } from "./MessageText";
import { ReactionBar } from "./ReactionBar";

interface ChatMessageRowProps {
  message: TeamChatMessage;
  /* A follow-on from the same author a moment later: no avatar or name, like Slack. */
  continued: boolean;
  /* Opens this message's thread; left out inside the thread itself. */
  onOpenThread?: (messageId: string) => void;
  /* Opens the author's profile in the secondary workspace. */
  onOpenProfile?: (memberId: string) => void;
}

const TOOL = "rounded px-1.5 py-0.5 text-xs text-fg-muted hover:bg-panel-hover hover:text-fg";

/** One chat message: its markdown, tags, reactions and thread summary. */
export function ChatMessageRow({ message, continued, onOpenThread, onOpenProfile }: ChatMessageRowProps): ReactElement {
  const author = memberById(message.author_id);
  const name = author?.name ?? message.author_id;
  const repliers = message.reply_author_ids.slice(0, 3);
  return (
    <li className={`group relative flex gap-3 px-5 hover:bg-panel-hover/60 ${continued ? "py-0.5" : "pt-2 pb-0.5"}`}>
      {onOpenThread && !message.deleted_at && (
        <div role="toolbar" aria-label="Message actions" className="absolute -top-3 right-5 hidden gap-0.5 rounded-md border border-line bg-popover p-0.5 shadow-sm group-focus-within:flex group-hover:flex">
          <button type="button" className={TOOL} onClick={() => onOpenThread(message.message_id)}>
            💬 View thread
          </button>
        </div>
      )}
      <div className="w-9 shrink-0">
        {continued ? (
          <span className="invisible pt-1 text-[10px] text-fg-subtle group-hover:visible">{clockTime(message.created_at)}</span>
        ) : (
          <button type="button" onClick={() => onOpenProfile?.(message.author_id)} disabled={!onOpenProfile} aria-label={`${name}'s profile`} className="rounded-full enabled:cursor-pointer">
            <PersonaAvatar name={name} modelKey={author?.model_key ?? null} />
          </button>
        )}
      </div>
      <div className="min-w-0 flex-1">
        {!continued && (
          <p className="flex flex-wrap items-baseline gap-2">
            {onOpenProfile ? (
              <button type="button" onClick={() => onOpenProfile(message.author_id)} className="font-semibold text-fg hover:underline">
                {name}
              </button>
            ) : (
              <span className="font-semibold text-fg">{name}</span>
            )}
            {message.author_kind === "AGENT" && <span className="rounded bg-panel-strong px-1 text-[10px] font-medium text-fg-subtle">AGENT</span>}
            <time dateTime={message.created_at} className="text-[11px] text-fg-subtle">
              {clockTime(message.created_at)}
            </time>
            {message.tags.map((tag) => (
              <span key={tag} className="rounded bg-violet-500/15 px-1 font-mono text-[10px] text-hue-violet">
                {tag}
              </span>
            ))}
          </p>
        )}
        {message.deleted_at ? <p className="text-sm italic text-fg-subtle">This message was deleted.</p> : <MessageText text={message.text} />}
        {message.edited_at && !message.deleted_at && <span className="text-[10px] text-fg-subtle">(edited)</span>}
        <ReactionBar reactions={reactionsOf(message)} />
        {onOpenThread && message.reply_count > 0 && (
          <button type="button" onClick={() => onOpenThread(message.message_id)} className="mt-1 flex items-center gap-2 rounded-md py-0.5 pr-2 text-xs hover:bg-panel">
            <span className="flex">
              {repliers.map((id) => (
                <span key={id} className="-ml-1 scale-75 first:ml-0">
                  <PersonaAvatar name={memberById(id)?.name ?? id} modelKey={memberById(id)?.model_key ?? null} />
                </span>
              ))}
            </span>
            <span className="font-semibold text-hue-indigo">{replyCount(message.reply_count)}</span>
            {message.last_reply_at && <span className="text-fg-subtle">Last reply {clockTime(message.last_reply_at)}</span>}
          </button>
        )}
      </div>
    </li>
  );
}
