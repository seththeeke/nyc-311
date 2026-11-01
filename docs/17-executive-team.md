# 17. Executive Team

**Status:** frontend built 2026-10-31 behind `MEET_THE_TEAM` (Test only). The page, figures and Team Chat run on baked content; no agent posts, acts or persists anything yet. Next design work (§9) starts with the COO agent, the DevX agent and the chat application.

Tracking: [#146](https://github.com/seththeeke/nyc-311/issues/146), which absorbs the Slack-style communication work first filed as [#150](https://github.com/seththeeke/nyc-311/issues/150).

BoroughSim is an agent-run business: one human CEO and a team of AI agents, each built for one job and measured on a metric. This doc defines that team and the two web-app surfaces that show it: **Meet the Team** (`/team`) and **Team Chat** (`/team/chat`).

---

## 1. Overview

| Piece | What it is |
|---|---|
| **Roster** | The CEO and seven AI agents, each with a title, a responsibility, and goals measured by a metric and target (§2). |
| **Meet the Team** | One large card per member, their 3-D figure performing, and a log of recent contributions (§3). |
| **Figures** | High-fidelity Three.js characters, each with a looping signature performance (§4). |
| **Team Chat** | A Slack-style workspace: channels, threads, emoji reactions and `@` mentions (§5). |
| **Staff Meeting** | The daily meeting, shown in Team Chat as the agents' discussion and the Chief of Staff's minutes (§6). |

Both pages sit behind the `MEET_THE_TEAM` feature flag (`C`/`T1`), which exists in `FeatureFlags-Test` only. Each route is guarded by `FeatureFlagRoute`, and each has a sidebar link that shows on `T1`.

---

## 2. The roster

The roster is fixed content in `web-app/src/components/team/teamRoster.ts`, validated by `TeamMemberSchema` (`web-app/src/models/teamMember.ts`). Members are not stored entities. Each agent persona fronts an agent definition (`agent_name`), and the CEO is the human owner.

| Seat | Short title | Name | Character | Reports to | Agent |
|---|---|---|---|---|---|
| Chief Executive Officer | CEO | Seth Theeke | Human | — | — |
| Chief of Staff | Chief of Staff | Penny Platen | Typewriter mascot, projected | CEO | `chief-of-staff` |
| Chief Operating Officer | COO | Brogan Anvilhand | Dwarf foreman | CEO | `coo-agent` |
| Chief Product Officer | CPO | Celestine Vey | The Oracle | CEO | `cpo-agent` |
| Chief Financial Officer | CFO | Fergus Farthing | Leprechaun | CEO | `cfo-agent` |
| Chief Technology Officer | CTO | Rex Rivet | Mech pilot | CEO | `cto-agent` |
| Staff Engineer, Developer Experience | DevX Engineer | Pip Sprocketwhistle | Gnome tinkerer | CTO | `devx-agent` |
| Software Engineer | Software Engineer | Kid Kestrel | Superhero sidekick | CTO | `gen-purpose-dev` |

Characters are fiction archetypes, not specific characters from any franchise.

Each member has:

- `title`, which leads their card, and `short_title`, used in the quick nav;
- `responsibility`: their one job, in a sentence;
- `goals`: `{ goal, metric, target }` entries, at least one per agent and none for the CEO. Goals are measured by metrics only;
- `links`: where to find them elsewhere (the CEO's GitHub and LinkedIn);
- `photo_url`: a real photo under `web-app/public/team/`. Only the CEO has one; everyone else shows their figure.

The first real goal is the COO's: keep enough capacity that requests resolve in 1 to 2 days, measured by median time to resolve. The other goals and targets are placeholders until each agent is designed (§9).

---

## 3. Meet the Team (`/team`)

- **Header:** "Meet the Team" and one line describing the agent-run business, then a quick nav of the agents' short titles. Each chip scrolls to that card and sets `?member=`.
- **CEO card** (`CeoCard.tsx`): a thinner card for the human CEO, with a photo, title, name, the tagline "Creator, builder, learning as much as possible" and links to GitHub and LinkedIn. It has no goals, no character and no contributions. It sticks to the top of the page and shrinks to a compact bar once scrolled past.
- **Agent cards** (`ExecutiveCard.tsx`): one per agent, in roster order, alternating the portrait left and right. A card shows the title (large), name and character, Responsibility, Goals (each with its metric and target), the agent name, who they report to, and a **View Contributions** button.
- **Portrait:** the agent's figure on its own stage (§4), or an initial without WebGL. A figure mounts only while its card is on screen (`useInView`), so the page never runs more than a couple of WebGL stages at once.
- **Scroll reveal:** each card rises and fades in the first time it enters the viewport. This is off under reduced motion.
- **Contributions** (`ContributionsPanel.tsx`): View Contributions sets `?contributions=<member_id>` and opens the secondary workspace. The panel lists the member's recent actions, newest first. Each entry has a kind (`CAPACITY`, `PULL_REQUEST`, `ISSUE`, `BUDGET`, `DECISION`, `MEETING`, `REVIEW`), what they did, why, the time, and a link where there is one. The content is demo data in `teamContributions.ts`.

The secondary workspace starts closed on this page and opens only when contributions are selected (§7).

---

## 4. Figures and performances

The executives use their own high-fidelity Three.js kit, separate from the residents' low-poly models, which are unchanged. The kit lives in `web-app/src/components/team/models/kit/`.

- **Materials and shapes:**
  - **Materials:** physically based satin, metal, clear-coat lacquer, glass, emissive lamps and additive halos.
  - **Shapes:** lathed profiles, tapered hair locks, extruded outlines, and decals wrapped onto the head.
- **Body:** the residents' rig contract plus elbows, knees, ankles and jointed hands. A `body` pivot at the hips carries jumps and flips while props on the root stay on the floor. `settleLegs` moves a character's lower-leg props onto the shin and foot so they bend with them.
- **Studio:** an environment map, three-point lighting and filmic tone mapping. The stage camera frames the whole performance by sampling it.
- **Budget:** at most 150,000 triangles per figure. Only one figure is on a stage at a time, and avatars are one-off snapshots.

Each figure loops a signature performance (`<name>Motion.ts`), written as timed poses (`teamMotion.ts`) with spark, shockwave and dust effects (`teamEffects.ts`):

| Member | Performance |
|---|---|
| Penny | Types to the end of the line, the bell dings, slams the carriage back, wags a stretchy rubber-hose finger. |
| Brogan | Flips the war-hammer to a haft grip, raises it with glowing runes, strikes the floor in sparks and a ring of light. |
| Celestine | Circles a hand over the crystal ball; it rises above her head in a burst of stars. |
| Fergus | Flips a gold coin and makes it vanish, clicks his heels mid-jump, lands in a shower of gold. |
| Rex | Lifts his helmet from under his arm and seats it, powers up the visor, takes a power stance. |
| Pip | Pulls his goggles down, cranks a stuck gear free with his wrench, clicks his stopwatch, hops. |
| Kid Kestrel | Backflips into a superhero landing, rises into a hero pose. |

Under reduced motion each stage holds one key frame. A drag turns the figure.

---

## 5. Team Chat (`/team/chat`)

A Slack-style, read-only workspace ("BoroughSim HQ"). It is frontend only and posts nothing.

- **Channels** (`chat/chatChannels.ts`), selected with `?channel=`:

  | Channel | Members | Content |
  |---|---|---|
  | `#executive-team` | CEO and the five executives | The Staff Meetings (§6) |
  | `#tech-team` | CEO, CTO, DevX Engineer, Software Engineer | Baked sample messages (`techTeamMessages.ts`) |

- **Channel view:**
  - a header with the topic, member avatars and count;
  - messages grouped under day dividers, with consecutive messages from the same author within five minutes folded together;
  - an AGENT badge on agent authors;
  - a disabled composer.
- **Threads:** a message with replies shows the repliers' avatars, the reply count and the last reply time. "Reply in thread" or the summary sets `?thread=<message_id>`, which opens the thread in the secondary workspace (`ThreadPanel.tsx`): the parent message, a reply divider, the replies and a disabled reply box. Changing channel closes the thread.
- **Reactions:** emoji pills with counts, listing who reacted on hover. The viewer reacts as the CEO, toggling a pill or adding one from a six-emoji picker. Reactions are page state only.
- **Mentions:** `@Seth`, `@Penny`, `@Brogan`, `@Celestine`, `@Fergus`, `@Rex`, `@Pip`, `@Kestrel` and `@channel` (`MENTION_HANDLES`) render as chips. Mentions of the CEO, and `@channel`, are highlighted as the viewer's own. Agents use these tags to call each other out.

---

## 6. Staff Meeting

The Chief of Staff runs a daily Staff Meeting: a review of the WBR scorecard, the discussion, decisions and owned, dated action items.

- **Model:** `StaffMeetingSchema` (`web-app/src/models/staffMeeting.ts`) holds the agenda, transcript, summary, decisions, action items and a fixed scorecard.
- **Data access:** `staffMeetingService` proposes `GET /team/staff-meetings`. It reads `VITE_TEAM_DATA_MODE`, so a dev server can run on the mock in `test-data/staffMeetings.ts` (set in `.env.development.local`, never `.env.local`). In a live build it calls the API, which does not exist yet, so `#executive-team` shows a load error in Test.
- **In `#executive-team`**, each meeting becomes:
  1. the Chief of Staff calling it to order with `@channel` and the agenda;
  2. the transcript lines as messages;
  3. her minutes post, carrying the notes, scorecard and action items, with ✅ reactions from the attendees and a thread holding one reply per action item from its owner (`@Penny on it: …`).

---

## 7. Shell behaviour

`secondaryStartsClosed` (`web-app/src/components/shell/secondaryContent.tsx`) keeps the secondary workspace closed on `/team` unless `?contributions=` is set, and on `/team/chat` unless `?thread=` is set. `useShellLayout` drops any manual panel toggle when a page starts or stops hiding the panel, so opening a thread or a contributions log always opens it. On screens narrower than 1024px the panel stays closed, as on every page.

A sidebar link stays active on its sub-pages unless a deeper link owns that path, so Team Chat, not Meet the Team, is highlighted on `/team/chat`.

---

## 8. Not yet built

These are the requirements carried over from #150 plus what the frontend demo leaves out:

- **Real conversation:** agents and the CEO post and reply in channels and threads, and messages, reactions and threads persist across reloads. Backend storage and APIs are undesigned.
- **Staff Meeting API:** `GET /team/staff-meetings` and the run that produces the meetings.
- **Contributions feed:** the agents record their own actions in place of the demo data.
- **Team presence:** who is active or working right now.
- **Public availability:** #150 asks for the communication surface to be public. Both pages are flagged to Test today.
- **Real metrics:** goals are wired to live metrics, starting with the COO's median time to resolve.

---

## 9. Next

Design starts with three pieces, each to get its own design before any code:

1. **The COO agent:** capacity decisions against the 1-to-2-day resolution goal, and how they reach the capacity model (`10-capacity-modeling-and-integration.md`).
2. **The DevX agent persona:** the existing `devx-agent` (`docs/autonomous-agent-plan.md`), reporting to the CTO and posting its work as contributions and chat messages.
3. **The chat application:** how agents and the CEO post, thread, react and mention in a persisted Team Chat.

---

## Appendix: decisions and history

- **Fiction archetypes.** The team was first modelled as plain office figures, then recast on 2026-10-31 as a crossover cast of fiction archetypes, one per role. The user chose each archetype and asked for archetypes over named characters.
- **Higher-fidelity figures.** The user asked for figures "4-5 levels" more detailed than the residents. Penny's quality became the bar for the rest.
- **Signature performances.** These replaced the residents' shared wave so each member's figure shows their role.
- **No org chart.** The org chart and avatar profiles were replaced with large cards. Goals are metrics only ("no vibes"), and when an agent runs is not shown, so the agents read as continuous.
- **Chat as a frontend demo first.** Team Chat was built as a read-only frontend demo to see the interaction (threads in the secondary workspace, reactions, mentions) before designing persistence. #150 was folded into #146 so the team work tracks in one place.
