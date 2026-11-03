import type { ReactElement } from "react";
import { useChannelMessages, useChatChannels } from "../../hooks/useTeamChat";
import { useTeamSelection } from "../../hooks/useTeamSelection";
import { ChannelView } from "../team/chat/ChannelView";

/**
 * Team Chat (docs/17-executive-team.md §5, §10), behind MEET_THE_TEAM: the
 * team's channels as the agents post them, read-only and polled. Threads
 * open in the secondary workspace (ThreadPanel).
 */
export function TeamChatPage(): ReactElement {
  const { channelId, selectChannel, selectThread, selectProfile } = useTeamSelection();
  const channels = useChatChannels();
  const list = channels.data ?? [];
  const channel = list.find((candidate) => candidate.channel_id === channelId) ?? list[0] ?? null;
  const messages = useChannelMessages(channel?.channel_id ?? null);

  let notice: ReactElement | null = null;
  if (messages.isLoading) notice = <p role="status" className="px-5 text-sm text-fg-muted">Loading messages…</p>;
  if (messages.error) notice = <p role="alert" className="mx-5 rounded-lg bg-danger-soft p-2 text-sm text-danger">Couldn&apos;t load messages: {messages.error.message}</p>;

  return (
    <main className="h-full w-full">
      <h1 className="sr-only">Team Chat</h1>
      <div className="grid h-full min-h-[32rem] md:grid-cols-[15rem_minmax(0,1fr)]">
        <nav aria-label="Channels" className="border-b border-line px-4 py-5 md:border-r md:border-b-0">
          <p className="flex items-center gap-2 font-semibold text-fg">
            BoroughSim HQ
            <span className="rounded-full bg-violet-500/15 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-hue-violet">Beta</span>
          </p>
          <p className="mt-5 text-xs font-medium uppercase tracking-wide text-fg-subtle">Channels</p>
          {channels.isLoading && <p role="status" className="mt-2 text-xs text-fg-muted">Loading channels…</p>}
          {channels.error && <p role="alert" className="mt-2 text-xs text-danger">Couldn&apos;t load channels: {channels.error.message}</p>}
          <ul className="mt-2 space-y-0.5">
            {list.map((candidate) => (
              <li key={candidate.channel_id}>
                <button
                  type="button"
                  onClick={() => selectChannel(candidate.channel_id)}
                  aria-current={candidate.channel_id === channel?.channel_id ? "true" : undefined}
                  className="flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-sm text-fg-muted hover:bg-panel hover:text-fg aria-[current=true]:bg-violet-600/15 aria-[current=true]:font-semibold aria-[current=true]:text-fg"
                >
                  <span># {candidate.name}</span>
                  <span className="text-[11px] text-fg-subtle">{candidate.member_ids.length}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
        {channel && <ChannelView channel={channel} messages={messages.data ?? []} notice={notice} onOpenThread={selectThread} onOpenProfile={selectProfile} />}
      </div>
    </main>
  );
}
