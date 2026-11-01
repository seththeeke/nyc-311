import type { ReactElement } from "react";
import { useChatThread } from "../../../hooks/useTeamChat";
import { useTeamSelection } from "../../../hooks/useTeamSelection";
import { replyCount } from "./chatChannels";
import { ChatMessageRow } from "./ChatMessageRow";

/**
 * A Team Chat thread (docs/17-executive-team.md §5), in the secondary
 * workspace: the message it hangs off, then its replies, polled while open.
 */
export function ThreadPanel(): ReactElement {
  const { channelId, threadId, selectThread } = useTeamSelection();
  const { data: thread, isLoading, error } = useChatThread(channelId, threadId);
  if (!threadId) return <p className="px-4 text-sm text-fg-muted">Open a thread from any message to follow the conversation here.</p>;
  if (isLoading) return <p role="status" className="px-4 text-sm text-fg-muted">Loading thread…</p>;
  if (error || !thread) return <p role="alert" className="mx-4 rounded-lg bg-danger-soft p-2 text-sm text-danger">Couldn&apos;t load the thread{error ? `: ${error.message}` : ""}</p>;
  const replies = thread.replies.items;
  return (
    <section aria-label="Thread" className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-line px-4 pb-2">
        <div>
          <h2 className="font-semibold text-fg">Thread</h2>
          <p className="text-xs text-fg-muted"># {thread.root.channel_id}</p>
        </div>
        <button type="button" onClick={() => selectThread(null)} aria-label="Close thread" className="rounded-lg px-2 py-1 text-fg-subtle hover:bg-panel-hover hover:text-fg">
          ×
        </button>
      </header>
      <ol aria-label="Thread messages" className="flex-1 overflow-y-auto py-2">
        <ChatMessageRow message={thread.root} continued={false} />
        <li role="separator" className="my-2 flex items-center gap-3 px-5 text-[11px] text-fg-subtle">
          {replyCount(replies.length)}
          <span className="h-px flex-1 bg-line" />
        </li>
        {replies.map((reply) => (
          <ChatMessageRow key={reply.message_id} message={reply} continued={false} />
        ))}
      </ol>
    </section>
  );
}
