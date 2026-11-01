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
| Hero | The simulation subhead, over a living street grid on a 2-D canvas at Manhattan's 29° tilt: 311 calls ping amber, trucks drive the streets to them with light trails, fixes burst green; the pointer lights the grid under it. Kinetic word-by-word headline, shimmering gradient line, Enter fleet with a spinning conic rim and a magnetic lean. |
| Run by agents | The executive team (CEO, Chief of Staff, COO, CPO, CFO, CTO; no engineers) on a slow orbit around "1 + N", each with their avatar: the CEO's photo, the agents' Three.js figures. Hovering pauses it. **Meet the Team** links to `/team` while `MEET_THE_TEAM` is `T1`. |
| Complaint ticker | An endless marquee of Street Condition descriptors. |
| From call to curb | Five stages joined by a line that draws itself with scroll; stages light as it reaches them. |
| Live numbers | This week's `GET /workspace/metrics` values and the fleet roster, counting up when scrolled into view. |
| Closing call | Breathing aurora and a large Enter fleet. |

Copy lives in `components/marketing/marketingContent.ts`. Colours come from the theme tokens, so the page follows DARK/LIGHT. `prefers-reduced-motion` stops every CSS animation inside the page, draws the city as one still frame, and shows the numbers without counting.

## 3. Data

No new backend. The page reads two existing public endpoints through their hooks (`useWorkspaceMetrics`, `useFleetLocations`) and shows "—" until they answer.
