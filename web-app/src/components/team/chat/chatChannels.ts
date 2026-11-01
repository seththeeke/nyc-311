import type { StaffMeeting } from "../../../models/staffMeeting";
import { meetingDay } from "../teamFormat";
import { CEO_ID } from "../teamRoster";
import { TECH_TEAM_MESSAGES } from "./techTeamMessages";

/*
 * Team Chat (#146, #150), a frontend demo of how the agents could talk
 * on Slack: two channels, #executive-team built from the Staff Meetings
 * and #tech-team with baked sample messages. Nothing is stored or sent.
 */

/** One emoji on a message and who reacted with it. */
export interface Reaction {
  emoji: string;
  member_ids: readonly string[];
}

export interface ChatMessage {
  message_id: string;
  author_id: string;
  at: string;
  /* May tag people as `@Brogan`; see MENTION_HANDLES. */
  text: string;
  /* The minutes of a Staff Meeting, attached to the Chief of Staff's post. */
  meeting?: StaffMeeting;
  reactions?: readonly Reaction[];
  /* The message's thread, oldest first. */
  replies?: readonly ChatMessage[];
}

/** The name each member answers to in an `@` tag; `@channel` tags everyone. */
export const MENTION_HANDLES: Readonly<Record<string, string>> = {
  [CEO_ID]: "Seth",
  "chief-of-staff": "Penny",
  coo: "Brogan",
  cpo: "Celestine",
  cfo: "Fergus",
  cto: "Rex",
  devx: "Pip",
  "gen-dev": "Kestrel",
};

export interface ChatChannel {
  channel_id: string;
  topic: string;
  member_ids: readonly string[];
}

export const EXECUTIVE_CHANNEL = "executive-team";
export const TECH_CHANNEL = "tech-team";

export const CHAT_CHANNELS: readonly ChatChannel[] = [
  {
    channel_id: EXECUTIVE_CHANNEL,
    topic: "One goal: lower cost, same high-quality service. Staff Meeting daily at 08:00.",
    member_ids: [CEO_ID, "chief-of-staff", "coo", "cpo", "cfo", "cto"],
  },
  {
    channel_id: TECH_CHANNEL,
    topic: "What ships, what breaks and what it costs.",
    member_ids: [CEO_ID, "cto", "devx", "gen-dev"],
  },
];

export function channelById(channelId: string | null): ChatChannel {
  return CHAT_CHANNELS.find((channel) => channel.channel_id === channelId) ?? CHAT_CHANNELS[0];
}

/** Each Staff Meeting as it would land in #executive-team: the call to order, the discussion and the minutes, oldest first. */
export function meetingMessages(meetings: readonly StaffMeeting[]): ChatMessage[] {
  return [...meetings]
    .sort((a, b) => a.started_at.localeCompare(b.started_at))
    .flatMap((meeting) => [
      {
        message_id: `${meeting.meeting_id}-open`,
        author_id: meeting.notes_by,
        at: meeting.started_at,
        text: `*ding* @channel Staff Meeting is starting. Agenda: ${meeting.agenda.join("; ")}.`,
      },
      ...meeting.transcript.map((line, i) => ({ message_id: `${meeting.meeting_id}-${i}`, author_id: line.speaker_id, at: line.at, text: line.text })),
      {
        message_id: `${meeting.meeting_id}-minutes`,
        author_id: meeting.notes_by,
        at: meeting.ended_at,
        text: "Minutes are up, sugar. Action items have owners and dates; owners, check in below.",
        meeting,
        reactions: [
          { emoji: "✅", member_ids: [...new Set(meeting.transcript.map((line) => line.speaker_id))].filter((id) => id !== meeting.notes_by) },
          { emoji: "🔔", member_ids: [meeting.notes_by] },
        ],
        replies: meeting.action_items.map((item, i) => ({
          message_id: `${meeting.meeting_id}-reply-${i}`,
          author_id: item.owner_id,
          at: new Date(Date.parse(meeting.ended_at) + (i + 1) * 60_000).toISOString(),
          text: `@${MENTION_HANDLES[meeting.notes_by] ?? meeting.notes_by} on it: ${item.title}, due ${meetingDay(item.due_on)}.`,
          reactions: [{ emoji: "👍", member_ids: [meeting.notes_by] }],
        })),
      },
    ]);
}

/** A channel's messages: #executive-team from the Staff Meetings, #tech-team from the samples. */
export function channelMessages(channel: ChatChannel, meetings: readonly StaffMeeting[]): readonly ChatMessage[] {
  return channel.channel_id === EXECUTIVE_CHANNEL ? meetingMessages(meetings) : TECH_TEAM_MESSAGES;
}

/** "1 reply", "3 replies". */
export function replyCount(count: number): string {
  return `${count} ${count === 1 ? "reply" : "replies"}`;
}
