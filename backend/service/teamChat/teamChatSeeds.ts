import type { TeamChatChannelSeed } from "../../models/teamChatChannel";
import type { TeamChatMemberSeed } from "../../models/teamChatMember";

/*
 * Team Chat's members and channels (docs/17-executive-team.md §10.2), synced
 * on every deploy. member_ids match the web-app roster. An agent signs in as
 * <agent_name>@agents.boroughsim.com. The CEO has no sign-in until posting
 * from the web app is built (§10.8).
 */
export type TeamChatSeedEnv = "TEST" | "PROD";

export interface TeamChatSeeds {
  members: TeamChatMemberSeed[];
  channels: TeamChatChannelSeed[];
}

const agent = (member_id: string, handle: string, agentName: string): TeamChatMemberSeed => ({
  member_id,
  handle,
  kind: "AGENT",
  email: `${agentName}@agents.boroughsim.com`,
  status: "ACTIVE",
});

const MEMBERS: TeamChatMemberSeed[] = [
  { member_id: "ceo", handle: "Seth", kind: "HUMAN", email: null, status: "ACTIVE" },
  agent("chief-of-staff", "Penny", "chief-of-staff-agent"),
  agent("coo", "Brogan", "coo-agent"),
  agent("cpo", "Celestine", "cpo-agent"),
  agent("cto", "Rex", "cto-agent"),
  agent("devx", "Pip", "devx-agent"),
  agent("gen-dev", "Kestrel", "gen-purpose-dev"),
];

const CHANNELS: TeamChatChannelSeed[] = [
  {
    channel_id: "executive-team",
    name: "executive-team",
    topic: "One goal: lower cost, same high-quality service.",
    member_ids: ["ceo", "chief-of-staff", "coo", "cpo", "cto"],
    visibility: "PUBLIC",
  },
  {
    channel_id: "tech-team",
    name: "tech-team",
    topic: "What ships, what breaks and what it costs.",
    member_ids: ["ceo", "cto", "devx", "gen-dev"],
    visibility: "PUBLIC",
  },
  {
    channel_id: "executive-assistant",
    name: "executive-assistant",
    topic: "Yesterday's work across the team, every morning.",
    member_ids: ["ceo", "chief-of-staff"],
    visibility: "PUBLIC",
  },
];

/* Test only: the integration suite's own member and channel (§14, L4). */
const INTEGRATION_MEMBER: TeamChatMemberSeed = { member_id: "integration-tester", handle: "Tester", kind: "HUMAN", email: "test-admin@boroughsim.com", status: "ACTIVE" };
const INTEGRATION_CHANNEL: TeamChatChannelSeed = {
  channel_id: "integration-tests",
  name: "integration-tests",
  topic: "The pipeline's Team Chat integration tests post here.",
  member_ids: ["integration-tester"],
  visibility: "PUBLIC",
};

export function teamChatSeeds(env: TeamChatSeedEnv): TeamChatSeeds {
  return env === "TEST" ? { members: [...MEMBERS, INTEGRATION_MEMBER], channels: [...CHANNELS, INTEGRATION_CHANNEL] } : { members: MEMBERS, channels: CHANNELS };
}
