import type { TeamMember } from "../../models/teamMember";

/*
 * BoroughSim's executive team (#146): one human CEO and a crossover cast
 * of AI agents, each a character from a different corner of fiction. Fixed
 * content, not fetched; the agents themselves live in `.claude/agents/`.
 * Order is display order.
 */
export const CEO_ID = "ceo";

export const TEAM_ROSTER: readonly TeamMember[] = [
  {
    member_id: CEO_ID,
    name: "Seth Theeke",
    title: "Chief Executive Officer",
    character: "Human, the only one",
    role: "CEO",
    kind: "HUMAN",
    agent_name: null,
    reports_to: null,
    model_key: null,
    short_title: "CEO",
    photo_url: "/team/seth-theeke.jpeg",
    responsibility: "Creator, builder, learning as much as possible",
    goals: [],
    live: true,
    links: [
      { label: "GitHub", url: "https://github.com/seththeeke" },
      { label: "LinkedIn", url: "https://www.linkedin.com/in/sptheeke/" },
    ],
  },
  {
    member_id: "chief-of-staff",
    name: "Penny Platen",
    title: "Chief of Staff",
    character: "Typewriter mascot, projected",
    role: "CHIEF_OF_STAFF",
    kind: "AGENT",
    agent_name: "chief-of-staff-agent",
    reports_to: CEO_ID,
    model_key: "penny-platen",
    short_title: "Chief of Staff",
    photo_url: null,
    responsibility: "Tracks the work across the team, reports on major changes, and consolidates activity amongst the chaos.",
    goals: [],
    live: true,
    links: [],
  },
  {
    member_id: "coo",
    name: "Brogan Anvilhand",
    title: "Chief Operating Officer",
    character: "Dwarf foreman",
    role: "COO",
    kind: "AGENT",
    agent_name: "coo-agent",
    reports_to: CEO_ID,
    model_key: "brogan-anvilhand",
    short_title: "COO",
    photo_url: null,
    responsibility: "Owns the fleet and performance. Recruits and releases drivers as needed to maintain performance.",
    goals: [{ goal: "Maintain request resolution between 1 to 2 days", metric: "Median time to resolve", target: "1–2 days" }],
    live: true,
    links: [],
  },
  {
    member_id: "cpo",
    name: "Celestine Vey",
    title: "Chief Product Officer",
    character: "The Oracle",
    role: "CPO",
    kind: "AGENT",
    agent_name: "cpo-agent",
    reports_to: CEO_ID,
    model_key: "celestine-vey",
    short_title: "CPO",
    photo_url: null,
    responsibility: "Make every driver as efficient as possible, keep residents informed and satisfied",
    goals: [{ goal: "Reduce cost of execution", metric: "Cost per accepted order", target: "<$25" },
      { goal: "Increase number of satisfied customer interactions", metric: "% of satisfied customer interactions", target: ">80%" }
    ],
    live: true,
    links: [],
  },
  {
    member_id: "cfo",
    name: "Fergus Farthing",
    title: "Chief Financial Officer",
    character: "Leprechaun",
    role: "CFO",
    kind: "AGENT",
    agent_name: "cfo-agent",
    reports_to: CEO_ID,
    model_key: "fergus-farthing",
    short_title: "CFO",
    photo_url: null,
    responsibility: "Owns the budget and the unit economics, and flags spend before it lands.",
    goals: [{ goal: "Hold cloud spend under budget", metric: "AWS spend, month to date", target: "Under $20" }, { goal: "Bring down the cost of each order", metric: "Cost per resolved order", target: "<$38" }],
    live: false,
    links: [],
  },
  {
    member_id: "cto",
    name: "Rex Rivet",
    title: "Chief Technology Officer",
    character: "Mech pilot",
    role: "CTO",
    kind: "AGENT",
    agent_name: "cto-agent",
    reports_to: CEO_ID,
    model_key: "rex-rivet",
    short_title: "CTO",
    photo_url: null,
    responsibility: "Decides what gets built, reviews all changes, and keeps the platform reliable and leads the engineering agents.",
    goals: [{ goal: "Keep order execution reliable", metric: "Execution failure rate", target: "Under 2%" }],
    live: true,
    links: [],
  },
  {
    member_id: "devx",
    name: "Pip Sprocketwhistle",
    title: "Staff Engineer, Developer Experience",
    character: "Gnome tinkerer",
    role: "ENGINEER",
    kind: "AGENT",
    agent_name: "devx-agent",
    reports_to: "cto",
    model_key: "pip-sprocketwhistle",
    short_title: "DevX Engineer",
    photo_url: null,
    responsibility: "Finds and fixes developer friction, slow builds, flaky tests and gaps in coverage.",
    goals: [{ goal: "Keep the pipeline moving", metric: "Commit to Prod deploy time", target: "Under 30 min" },
      { goal: "Maintain code quality guardrails", metric: "Unit and Integration Test Coverage", target: ">90%" }
    ],
    live: true,
    links: [],
  },
  {
    member_id: "gen-dev",
    name: "Kid Kestrel",
    title: "Software Engineer",
    character: "Superhero sidekick",
    role: "ENGINEER",
    kind: "AGENT",
    agent_name: "gen-purpose-dev",
    reports_to: "cto",
    model_key: "kid-kestrel",
    short_title: "Software Engineer",
    photo_url: null,
    responsibility: "Full cycle developer, triage, design, implement, and verify.",
    goals: [{ goal: "Land assigned work quickly", metric: "Assigned issues merged within 3 days", target: "80% or more" }],
    live: false,
    links: [],
  },
];

export function memberById(memberId: string | null): TeamMember | null {
  return TEAM_ROSTER.find((member) => member.member_id === memberId) ?? null;
}

/** Everyone reporting straight to `memberId`, in roster order. */
export function directReports(memberId: string): TeamMember[] {
  return TEAM_ROSTER.filter((member) => member.reports_to === memberId);
}
