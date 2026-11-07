# 18 — Marketing page

**Status:** done (2026-11-04), frontend only; built, tested and pushed in `4140504`. Turning it on in Prod is the CEO's step (`MARKETING_PAGE` to `T1`). **Flag:** `MARKETING_PAGE` (`C`/`T1`) is `T1` in `FeatureFlags-Test` and `C` in `FeatureFlags-Prod`.

A full-screen marketing page at `/` that sells BoroughSim and ends on **Enter fleet**, which opens the 3-D map.

## 1. Routing

- `MarketingGate` (`web-app/src/routes/MarketingGate.tsx`) wraps the shell route. On `T1`, a first visit to `/` gets `MarketingPage` instead of the shell. Every other path, and `C`, passes straight through.
- **Enter fleet** (hero, closing section) sets `nyc311.marketing.entered` in session storage. From then on `/` is the map for the rest of the tab, so the map's own links home (the Map menu entry, leaving a dive-in) keep working. A new tab sees the marketing page again.
- The page renders outside the app shell (no sidebar or secondary workspace) as a `fixed` scroll container, and is lazy-loaded as its own chunk.

## 2. Sections

| Section | What it does |
|---|---|
| Hero | The simulation subhead over a living street grid on a 2-D canvas at Manhattan's 29° tilt: 311 calls ping amber, trucks drive the streets to them with light trails, fixes burst green; the pointer lights the grid under it. Kinetic word-by-word headline. **Enter fleet** has a spinning conic rim, a double pulsing halo, a light sweep and a magnetic lean, and selects itself (focus and glow, so Enter works) 1.7 s in, unless the visitor has focused something else. |
| Run by agents | The executive team (CEO, Chief of Staff, COO, CPO, CTO; no engineers) on a slow orbit around "Human + Agents", each with their avatar: the CEO's photo, the agents' Three.js figures. Hovering pauses it. **Meet the Team**, a shimmering violet-rose-amber gradient button, links to `/team` while `MEET_THE_TEAM` is `T1`. |
| From call to curb | A scroll story: the section pins its stage and each 55vh of scroll brings the next large step card forward (the last tips back and away), with a five-segment rail filling as you scroll. Each card holds the step copy and its own animated scene, which plays as the card arrives. Amber is the real city, cyan is BoroughSim. 1 **Real data**: a NYC Open Data 311 record (real field names) typing out in a terminal under a REAL DATA badge. 2 **Serviceability check**: a scanner sweeps incoming complaints; street repairs pass, the rest are struck through, with "BoroughSim does / doesn't" panels. 3 **Cost estimate**: the complaint's metadata as chips, a growing breakdown and a counting total (illustrative numbers). 4 **Scheduling**: a fleet board where the new order drops into an operator's free slot. 5 **Resolution**: a check draws itself, sparks fly, `ORDER_RESOLVED` goes to residents following it. |
| The residents | Five featured residents (Hawthorn, Juniper, Sycamore, Ginkgo, Yellowwood, from `GET /residents`) as a bobbing crowd of avatars, their latest real ideas (`GET /ideas`) cycling in a speech bubble with the speaker ringed, and the flywheel: 1 Promise (BoroughSim promises to resolve a job), 2 Ideas (residents have ideas about the service or their job), 3 Tools (BoroughSim gives them tools to act on those ideas), 4 Insight (the tool requests show what customers need), 5 Build (BoroughSim builds features and tools to improve service). A comet hops station to station. **Meet the residents** links to `/residents`. |
| This week | A second scroll story over the fleet map workspace's weekly snapshot (same cached queries): four large cards, 55vh of scroll each, with a four-segment rail. **Capacity**: a round glass bowl that fills with a messy pile of small trucks, one dropped in per slot up to the share of operators out on a job. **Total cost (est.)**: a rain of dollar signs. **Requests serviced**: 120 dots land amber (accepted), then a green wave flips the serviced share. **Mean time to resolve**: a 24-hour stopwatch whose hand spins twice and settles on the value, with an elapsed arc. Each figure counts up as its card arrives, with its week-over-week delta. |
| Closing call | A giant gradient headline over a breathing aurora and twinkling stars, a large Enter fleet, and **Patch**, BoroughSim's mascot: a repair truck with big blinking eyes, a flashing beacon and spinning wheels, driving a road whose lane lines rush past under a drifting night skyline. Every 5 s a pothole rolls in, Patch bounces over it, and it comes out patched with a sparkle while Patch says a new line. |

Copy lives in `components/marketing/marketingContent.ts` and `journeySteps.ts`. Colours come from the theme tokens, so the page follows DARK/LIGHT. `prefers-reduced-motion` stops every CSS animation inside the page, draws the city as one still frame, holds the flywheel and drops the card transitions, and shows the numbers without counting.

## 3. Data

No new backend. The page reads existing public endpoints through their hooks: `useWorkspaceMetrics` and `useFleetLocations` (the same cached queries as the map's workspace tiles), `useResidentPersonas` and `useResidentIdeas` (the customer's read API). Values show "—" until they answer.

## 4. Load performance

- **Avatars render in a Web Worker.** `useResidentAvatar` draws each 3-D avatar on an `OffscreenCanvas` in `residents/models/avatarWorker.ts` (the same scene code as before, via `drawAvatar`) and shows it as a blob URL. Browsers without worker WebGL fall back to the main thread, one render per idle slot. Concurrent requests for one model share a render.
- **Marketing avatars draw only as their section nears the screen** (600px ahead).
- **Below-the-fold sections use `content-visibility: auto`** (`.mk-lazy-section`): the team orbit, the residents and the closing scene skip layout, paint and animation until near the screen.
- **`MarketingGate` fetches the page chunk alongside the flag lookup.**
- Measured on a production build (mock data, 2026-11-04): main-thread blocking during load went from ~650 ms to 0, and first contentful paint from ~820 ms to ~450 ms.
