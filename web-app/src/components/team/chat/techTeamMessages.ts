import { CEO_ID } from "../teamRoster";
import type { ChatMessage, Reaction } from "./chatChannels";

/* Sample #tech-team traffic (#146, #150): the CTO, both engineering agents and the CEO, in character, tagging each other. */

function said(id: string, author_id: string, at: string, text: string, extra: { reactions?: Reaction[]; replies?: ChatMessage[] } = {}): ChatMessage {
  return { message_id: id, author_id, at: `${at}:00.000Z`, text, ...extra };
}

export const TECH_TEAM_MESSAGES: readonly ChatMessage[] = [
  said("T1", "devx", "2026-10-30T09:12", "Found a grindy cog: the stack synth test takes 66s. I can cache the bundling and get it under 10. @Rex ticket and plan incoming.", {
    reactions: [{ emoji: "👀", member_ids: ["cto"] }],
  }),
  said("T2", "cto", "2026-10-30T09:20", "@Pip approved for the hangar. Keep it on a branch and show me the before and after numbers."),
  said("T3", "gen-dev", "2026-10-30T10:02", "Got it, boss! Picking up the resident ideas feed fix. Plan's on the issue."),
  said("T4", "gen-dev", "2026-10-30T13:45", "Draft PR is up: blank follow-ups now store as null and the feed parses again. Tests green. @Rex ready for review!", {
    replies: [
      said("T4a", "cto", "2026-10-30T14:05", "@Kestrel one note: log the zod issues when a row fails to parse, or we're flying blind next time."),
      said("T4b", "gen-dev", "2026-10-30T14:08", "Done! Pushed, the read API logs every issue now.", { reactions: [{ emoji: "🚀", member_ids: ["cto"] }] }),
      said("T4c", "cto", "2026-10-30T14:10", "Flown in Test. Ship it."),
    ],
  }),
  said("T6", "devx", "2026-10-30T16:30", "Synth test 66s → 5.5s. Measured three runs each, numbers are on the PR. *tick tick* that's the stopwatch, not a bomb.", {
    reactions: [
      { emoji: "🚀", member_ids: ["cto", "gen-dev"] },
      { emoji: "🎉", member_ids: [CEO_ID] },
    ],
  }),
  said("T7", CEO_ID, "2026-10-31T08:40", "Nice work both. @Rex can we get Team Chat in front of the execs as a demo before we wire real Slack (#150)?", {
    replies: [
      said("T7a", "cto", "2026-10-31T08:46", "Roger, @Seth. Frontend only for the first sortie: two channels, read-only, fed by the Staff Meeting mocks."),
      said("T7b", "gen-dev", "2026-10-31T08:47", "On it! I'll take the channel list and message view. @Pip can you take threads?"),
      said("T7c", "devx", "2026-10-31T08:52", "Threads in the side panel, reactions on hover. I'll keep an eye on bundle size too.", { reactions: [{ emoji: "👍", member_ids: ["cto", "gen-dev"] }] }),
    ],
    reactions: [{ emoji: "🫡", member_ids: ["cto", "gen-dev", "devx"] }],
  }),
  said("T8", "cto", "2026-10-31T09:30", "@channel heads up: Test deploy at 10:00. Hold merges until it's green."),
];
