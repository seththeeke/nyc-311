import { type ReactElement, useState } from "react";
import { PersonaAvatar } from "../../residents/PersonaAvatar";
import { clockTime } from "../teamFormat";
import { memberById } from "../teamRoster";
import { type ChatMessage, replyCount } from "./chatChannels";
import { MeetingMinutes } from "./MeetingMinutes";
import { MessageText } from "./MessageText";
import { ReactionBar, useReactions } from "./ReactionBar";

interface ChatMessageRowProps {
  message: ChatMessage;
  /* A follow-on from the same author a moment later: no avatar or name, like Slack. */
  continued: boolean;
  /* Opens this message's thread; left out inside the thread itself. */
  onOpenThread?: (messageId: string) => void;
}

const TOOL = "rounded px-1.5 py-0.5 text-xs text-fg-muted hover:bg-panel-hover hover:text-fg";

/** One chat message: tags, reactions, the thread summary, and the Staff Meeting minutes when it carries them. */
export function ChatMessageRow({ message, continued, onOpenThread }: ChatMessageRowProps): ReactElement {
  const author = memberById(message.author_id);
  const name = author?.name ?? message.author_id;
  const [reactions, toggle] = useReactions(message.reactions);
  const [picking, setPicking] = useState(false);
  const replies = message.replies ?? [];
  const react = (emoji: string): void => {
    toggle(emoji);
    setPicking(false);
  };
  return (
    <li className={`group relative flex gap-3 px-5 hover:bg-panel-hover/60 ${continued ? "py-0.5" : "pt-2 pb-0.5"}`}>
      <div role="toolbar" aria-label="Message actions" className="absolute -top-3 right-5 hidden gap-0.5 rounded-md border border-line bg-popover p-0.5 shadow-sm group-focus-within:flex group-hover:flex">
        <button type="button" className={TOOL} onClick={() => setPicking((open) => !open)} aria-expanded={picking}>
          😀 Add reaction
        </button>
        {onOpenThread && (
          <button type="button" className={TOOL} onClick={() => onOpenThread(message.message_id)}>
            💬 Reply in thread
          </button>
        )}
      </div>
      <div className="w-9 shrink-0">
        {continued ? (
          <span className="invisible pt-1 text-[10px] text-fg-subtle group-hover:visible">{clockTime(message.at)}</span>
        ) : (
          <PersonaAvatar name={name} modelKey={author?.model_key ?? null} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        {!continued && (
          <p className="flex items-baseline gap-2">
            <span className="font-semibold text-fg">{name}</span>
            {author?.kind === "AGENT" && <span className="rounded bg-panel-strong px-1 text-[10px] font-medium text-fg-subtle">AGENT</span>}
            <time dateTime={message.at} className="text-[11px] text-fg-subtle">
              {clockTime(message.at)}
            </time>
          </p>
        )}
        <MessageText text={message.text} />
        {message.meeting && <MeetingMinutes meeting={message.meeting} />}
        <ReactionBar reactions={reactions} onToggle={react} picking={picking} />
        {onOpenThread && replies.length > 0 && (
          <button type="button" onClick={() => onOpenThread(message.message_id)} className="mt-1 flex items-center gap-2 rounded-md py-0.5 pr-2 text-xs hover:bg-panel">
            <span className="flex">
              {[...new Set(replies.map((reply) => reply.author_id))].slice(0, 3).map((id) => (
                <span key={id} className="-ml-1 scale-75 first:ml-0">
                  <PersonaAvatar name={memberById(id)?.name ?? id} modelKey={memberById(id)?.model_key ?? null} />
                </span>
              ))}
            </span>
            <span className="font-semibold text-hue-indigo">
              {replyCount(replies.length)}
            </span>
            <span className="text-fg-subtle">Last reply {clockTime(replies[replies.length - 1].at)}</span>
          </button>
        )}
      </div>
    </li>
  );
}
