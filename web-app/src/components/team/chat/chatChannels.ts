import type { TeamChatMessage } from "../../../models/teamChatMessage";
import { CEO_ID } from "../teamRoster";

/* Team Chat display helpers (docs/17-executive-team.md §10). */

/** One emoji on a message and who reacted with it. */
export interface Reaction {
  emoji: string;
  member_ids: readonly string[];
}

/** The name each member answers to in an `@` tag; `@channel` tags everyone. */
export const MENTION_HANDLES: Readonly<Record<string, string>> = {
  [CEO_ID]: "Seth",
  "chief-of-staff": "Penny",
  coo: "Brogan",
  cpo: "Celestine",
  cto: "Rex",
  devx: "Pip",
  "aws-cost": "Grimble",
  "software-analyzer": "Sable",
  "gen-dev": "Kestrel",
};

/** A message's reactions as pills, in the order the API lists them, empty ones dropped. */
export function reactionsOf(message: TeamChatMessage): Reaction[] {
  return Object.entries(message.reactions)
    .filter(([, member_ids]) => member_ids.length > 0)
    .map(([emoji, member_ids]) => ({ emoji, member_ids }));
}

/** "1 reply", "3 replies". */
export function replyCount(count: number): string {
  return `${count} ${count === 1 ? "reply" : "replies"}`;
}
