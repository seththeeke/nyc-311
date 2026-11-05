# 18 — Marketing page

**Status:** mockup, frontend only. **Flag:** `MARKETING_PAGE` (`C`/`T1`) is `T1` in `FeatureFlags-Test` and `C` in `FeatureFlags-Prod`.

A full-screen marketing page at `/` that sells BoroughSim and ends on **Enter fleet**, which opens the 3-D map.

## 1. Routing

- `MarketingGate` (`web-app/src/routes/MarketingGate.tsx`) wraps the shell route. On `T1`, a first visit to `/` gets `MarketingPage` instead of the shell. Every other path, and `C`, passes straight through.
- **Enter fleet** (hero, closing section) sets `nyc311.marketing.entered` in session storage. From then on `/` is the map for the rest of the tab, so the map's own links home (the Map menu entry, leaving a dive-in) keep working. A new tab sees the marketing page again.
- The page renders outside the app shell (no sidebar or secondary workspace) as a `fixed` scroll container, and is lazy-loaded as its own chunk.

## 2. Sections

| Section | What it does |
|---|---|
| Hero | The simulation subhead over a living street grid on a 2-D canvas at Manhattan's 29° tilt: 311 calls ping amber, trucks drive the streets to them with light trails, fixes burst green; the pointer lights the grid under it. Kinetic word-by-word headline. **Enter fleet** has a spinning conic rim, a double pulsing halo, a light sweep and a magnetic lean, and selects itself (focus, glow, "or press Enter") 1.7 s in, unless the visitor has focused something else. |
| Run by agents | The executive team (CEO, Chief of Staff, COO, CPO, CFO, CTO; no engineers) on a slow orbit around "1 + N", each with their avatar: the CEO's photo, the agents' Three.js figures. Hovering pauses it. **Meet the Team** links to `/team` while `MEET_THE_TEAM` is `T1`. |
| From call to curb | One call's journey as five auto-playing, clickable steps (6 s each, paused under the pointer), each with its own animated scene. Amber is the real city, cyan is BoroughSim. 1 **Real data**: a NYC Open Data 311 record (real field names) typing out in a terminal under a REAL DATA badge. 2 **Serviceability check**: a scanner sweeps incoming complaints; street repairs pass, the rest are struck through, with "BoroughSim does / doesn't" panels. 3 **Cost estimate**: the complaint's metadata as chips, a growing breakdown and a counting total (illustrative numbers). 4 **Scheduling**: a fleet board where the new order drops into an operator's free slot. 5 **Resolution**: a check draws itself, sparks fly, `ORDER_RESOLVED` goes to residents following it. |
| The residents | The simulated residents (`GET /residents`) as a bobbing crowd of avatars, their latest real ideas (`GET /ideas`) cycling in a speech bubble with the speaker ringed, and the flywheel: a need, they reach out (public API), a Contact is logged, the CPO files the work, the agents ship it. A comet hops station to station. **Meet the residents** links to `/residents`. |
| This week | The fleet map workspace's weekly snapshot, tile for tile: Capacity, Requests Accepted, Serviced, Total Cost (Est.), Mean and Median Time to Resolve, with its labels, formats and week-over-week deltas, counting up into view. |
| Closing call | Breathing aurora and a large Enter fleet. |

Copy lives in `components/marketing/marketingContent.ts` and `journeySteps.ts`. Colours come from the theme tokens, so the page follows DARK/LIGHT. `prefers-reduced-motion` stops every CSS animation inside the page, draws the city as one still frame, holds the journey and the flywheel, and shows the numbers without counting.

## 3. Data

No new backend. The page reads existing public endpoints through their hooks: `useWorkspaceMetrics` and `useFleetLocations` (the same cached queries as the map's workspace tiles), `useResidentPersonas` and `useResidentIdeas` (the customer's read API). Values show "—" until they answer.
