import type { ReactElement } from "react";
import { useStaffMeetings } from "../../../hooks/useStaffMeetings";
import { useTeamSelection } from "../../../hooks/useTeamSelection";
import { channelById, channelMessages, replyCount } from "./chatChannels";
import { ChatMessageRow } from "./ChatMessageRow";

/**
 * A Team Chat thread (#146, #150), in the secondary workspace: the
 * message it hangs off, then its replies, and a read-only reply box.
 */
export function ThreadPanel(): ReactElement {
  const { channelId, threadId, selectThread } = useTeamSelection();
  const channel = channelById(channelId);
  const { data: meetings } = useStaffMeetings();
  const parent = threadId ? channelMessages(channel, meetings ?? []).find((message) => message.message_id === threadId) : undefined;
  if (!parent) return <p className="px-4 text-sm text-fg-muted">Open a thread from any message to follow the conversation here.</p>;
  const replies = parent.replies ?? [];
  return (
    <section aria-label="Thread" className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-line px-4 pb-2">
        <div>
          <h2 className="font-semibold text-fg">Thread</h2>
          <p className="text-xs text-fg-muted"># {channel.channel_id}</p>
        </div>
        <button type="button" onClick={() => selectThread(null)} aria-label="Close thread" className="rounded-lg px-2 py-1 text-fg-subtle hover:bg-panel-hover hover:text-fg">
          ×
        </button>
      </header>
      <ol aria-label="Thread messages" className="flex-1 overflow-y-auto py-2">
        <ChatMessageRow message={parent} continued={false} />
        <li role="separator" className="my-2 flex items-center gap-3 px-5 text-[11px] text-fg-subtle">
          {replyCount(replies.length)}
          <span className="h-px flex-1 bg-line" />
        </li>
        {replies.map((reply) => (
          <ChatMessageRow key={reply.message_id} message={reply} continued={false} />
        ))}
      </ol>
      <div className="border-t border-line p-3">
        <input type="text" disabled aria-label="Reply" placeholder="Reply… (demo, read-only)" className="w-full rounded-lg border border-line bg-panel-hover px-3 py-2 text-sm placeholder:text-fg-subtle" />
      </div>
    </section>
  );
}
