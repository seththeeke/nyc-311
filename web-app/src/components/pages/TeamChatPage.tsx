import type { ReactElement } from "react";
import { useStaffMeetings } from "../../hooks/useStaffMeetings";
import { useTeamSelection } from "../../hooks/useTeamSelection";
import { PAGE_CONTENT_CLASSES } from "../pageLayout";
import { CHAT_CHANNELS, channelById, channelMessages, EXECUTIVE_CHANNEL } from "../team/chat/chatChannels";
import { ChannelView } from "../team/chat/ChannelView";

/**
 * Team Chat (#146, #150), behind MEET_THE_TEAM: a Slack-style, read-only
 * demo of the team's channels. #executive-team carries the daily Staff
 * Meetings; #tech-team is the CTO, the engineering agents and the CEO.
 * Threads open in the secondary workspace (ThreadPanel).
 */
export function TeamChatPage(): ReactElement {
  const { channelId, selectChannel, selectThread } = useTeamSelection();
  const channel = channelById(channelId);
  const { data: meetings, isLoading, error } = useStaffMeetings();
  const executive = channel.channel_id === EXECUTIVE_CHANNEL;
  let notice: ReactElement | null = null;
  if (executive && isLoading) notice = <p role="status" className="px-5 text-sm text-fg-muted">Loading messages…</p>;
  if (executive && error) notice = <p role="alert" className="mx-5 rounded-lg bg-danger-soft p-2 text-sm text-danger">Couldn&apos;t load messages: {error.message}</p>;
  return (
    <main className={PAGE_CONTENT_CLASSES}>
      <h1 className="sr-only">Team Chat</h1>
      <div className="grid h-[calc(100vh-6rem)] min-h-[32rem] overflow-hidden rounded-2xl border border-line bg-panel md:grid-cols-[15rem_minmax(0,1fr)]">
        <nav aria-label="Channels" className="border-b border-line bg-panel-hover p-4 md:border-r md:border-b-0">
          <p className="font-semibold text-fg">BoroughSim HQ</p>
          <p className="text-[11px] text-fg-subtle">Demo workspace</p>
          <p className="mt-5 text-xs font-medium uppercase tracking-wide text-fg-subtle">Channels</p>
          <ul className="mt-2 space-y-0.5">
            {CHAT_CHANNELS.map((candidate) => (
              <li key={candidate.channel_id}>
                <button
                  type="button"
                  onClick={() => selectChannel(candidate.channel_id)}
                  aria-current={candidate.channel_id === channel.channel_id ? "true" : undefined}
                  className="flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-sm text-fg-muted hover:bg-panel hover:text-fg aria-[current=true]:bg-violet-600/15 aria-[current=true]:font-semibold aria-[current=true]:text-fg"
                >
                  <span># {candidate.channel_id}</span>
                  <span className="text-[11px] text-fg-subtle">{candidate.member_ids.length}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <ChannelView channel={channel} messages={channelMessages(channel, meetings ?? [])} notice={notice} onOpenThread={selectThread} />
      </div>
    </main>
  );
}
