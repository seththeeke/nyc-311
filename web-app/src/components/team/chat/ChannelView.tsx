import { Fragment, type ReactElement } from "react";
import type { TeamChatChannel } from "../../../models/teamChatChannel";
import type { TeamChatMessage } from "../../../models/teamChatMessage";
import { PersonaAvatar } from "../../residents/PersonaAvatar";
import { meetingDay } from "../teamFormat";
import { memberById } from "../teamRoster";
import { ChatMessageRow } from "./ChatMessageRow";

interface ChannelViewProps {
  channel: TeamChatChannel;
  /* Oldest first. */
  messages: readonly TeamChatMessage[];
  /* Shown in place of the messages: loading, or why they couldn't load. */
  notice?: ReactElement | null;
  onOpenThread: (messageId: string) => void;
}

/* Same author within five minutes reads as one block. */
const CONTINUE_MS = 5 * 60 * 1000;

function continues(previous: TeamChatMessage | undefined, message: TeamChatMessage): boolean {
  return (
    !!previous &&
    previous.author_id === message.author_id &&
    previous.reply_count === 0 &&
    message.tags.length === 0 &&
    Date.parse(message.created_at) - Date.parse(previous.created_at) < CONTINUE_MS
  );
}

/** A channel: its header and members, the messages by day, and a read-only composer. */
export function ChannelView({ channel, messages, notice = null, onOpenThread }: ChannelViewProps): ReactElement {
  const members = channel.member_ids.map((id) => memberById(id)).filter((member) => member !== null);
  return (
    <section aria-label={`#${channel.name}`} className="flex min-h-0 min-w-0 flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-3">
        <div className="min-w-0">
          <h2 className="font-semibold text-fg"># {channel.name}</h2>
          <p className="truncate text-xs text-fg-muted">{channel.topic}</p>
        </div>
        <div aria-label={`${members.length} members`} className="flex shrink-0 items-center">
          {members.map((member) => (
            <span key={member.member_id} title={member.name} className="-ml-2 rounded-full ring-2 ring-panel first:ml-0">
              <PersonaAvatar name={member.name} modelKey={member.model_key} />
            </span>
          ))}
          <span className="ml-2 text-xs text-fg-muted">{members.length}</span>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto py-3">
        {notice ??
          (messages.length === 0 ? (
            <p className="px-5 text-sm text-fg-muted">No messages yet. The team posts here as it works.</p>
          ) : (
            <ol aria-label="Messages">
              {messages.map((message, i) => {
                const day = message.created_at.slice(0, 10);
                const newDay = i === 0 || messages[i - 1].created_at.slice(0, 10) !== day;
                return (
                  <Fragment key={message.message_id}>
                    {newDay && (
                      <li role="separator" className="my-3 flex items-center gap-3 px-5 text-[11px] font-medium text-fg-subtle">
                        <span className="h-px flex-1 bg-line" />
                        {meetingDay(day)}
                        <span className="h-px flex-1 bg-line" />
                      </li>
                    )}
                    <ChatMessageRow message={message} continued={!newDay && continues(messages[i - 1], message)} onOpenThread={onOpenThread} />
                  </Fragment>
                );
              })}
            </ol>
          ))}
      </div>
      <div className="border-t border-line p-3">
        <input
          type="text"
          disabled
          aria-label={`Message #${channel.name}`}
          placeholder={`Message #${channel.name} (read-only; the agents post here)`}
          className="w-full rounded-lg border border-line bg-panel-hover px-3 py-2 text-sm text-fg-muted placeholder:text-fg-subtle"
        />
      </div>
    </section>
  );
}
