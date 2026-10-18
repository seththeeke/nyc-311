# Maps refactor — Mapv2, the 3-D city map

**Status (2026-10-17):** built and behind the `MAP_V2` flag. Test defaults to `T1`, Prod to `C`. Pre-`T2` pass done 2026-10-17 (§8): context-loss recovery, pinned versions, a pipeline browser smoke test, and a UI polish round. No backend or API changes; the only CDK change is that pipeline step.

**Read this first.** Mapv2 was built quickly as a prototype ("vibe coded") to prove the look and the interaction, not as hardened production code. It passes the normal gates: build, lint, tests and the 90% per-file coverage gate. But nothing exercises it in a real browser with a real GPU, and Three.js has failure modes this repo has never had to guard against. Section 4 lists the guardrails to add, and section 5 lists the assumptions the frontend makes. Work through both before setting `T2` in Prod.

---

## 1. What changed

### 1.1 The flag

`MAP_V2` lives in `FeatureFlags-Test` and `FeatureFlags-Prod`. It was created on 2026-10-15 at version 1 with treatments `C`/`T1`, and `T2` was added the same day (now version 2). Both writes went straight to DynamoDB with `--profile nyc311`, conditioned on the flag not existing (create) and on `version` (update). From here on, change it on the Admin → Feature Flags page.

| Treatment | Sidebar | `/` and `/about` | `/mapv2` |
|---|---|---|---|
| `C` (Prod default) | Classic **Map** only | Classic Leaflet map | Redirects to `/` |
| `T1` (Test default) | Classic **Map**, plus **Mapv2** under it | Classic Leaflet map | 3-D city |
| `T2` | One **Map** entry, pointing at `/mapv2`; classic entry hidden | `/` redirects to `/mapv2`; `/about` shows the 3-D city under the About drawer | 3-D city |

Mock data mode defaults `MAP_V2` to `T1`.

Like every flag, `MAP_V2` is read once per page load, so a change applies on the next refresh.

Under `T2`, the takeover only happens when the browser can create a WebGL2 context. Without one, `/` keeps the classic map (see §5.4).

### 1.2 Routes and shell

- **Routes:** `/mapv2/*` is one route (`AppRoutes.tsx`), so diving into a job (`/mapv2/job/:orderId`) never remounts the city behind it. It's guarded by `FeatureFlagRoute`, which now takes a list (`onTreatments`) so it passes on either `T1` or `T2`.
- **Takeover guard:** `routes/MapV2TakeoverRoute.tsx` sits on `/` and `/about`. It renders the classic map unless the flag is `T2` and WebGL2 is available.
- **Menu flag rules:** menu entries now carry a `MenuFlagRule` (`menuConfig.ts`) instead of a yes/no treatment.
  - `showOn`: shown only on these treatments.
  - `hideOn`: shown unless on these treatments.
  - `labelOn` and `alsoActiveOnFor`: per-treatment label and highlighted paths.
  - The pure resolver `resolveFlaggedLink` applies a rule. `FlaggedMenuLink` replaced `FeatureGate`, which was deleted.
- **Secondary panel:** it opens on `/mapv2/*`, like the classic map (it opened collapsed until 2026-10-17).
- **Existing map code:** `FleetMap`, `OperatorTrail`, `HomePage` and the fleet API are untouched.

### 1.3 Architecture

All new code is under `web-app/src/components/mapv2/`, plus `pages/MapV2Page.tsx`. It uses two new runtime dependencies, `maplibre-gl@6.14.0` and `three@0.186.1`.

```
MapV2Page ── useFleetLocations (existing 15 s poll)
 ├─ CityView ── useCityMap ─── MapLibre map (OpenFreeMap vector tiles, mapStyle.ts)
 │    │                         ├─ fleetOverlays.ts  MapLibre line/circle layers: selected trail, job sites
 │    │                         └─ three/fleetLayer.ts  custom 3-D layer: Three.js renders into
 │    │                              MapLibre's own WebGL context and camera matrix
 │    │                              └─ three/fleetScene.ts  one actor per Operator (truck + work zone)
 │    └─ useCityCamera  select / dive / return camera moves, control actions
 ├─ CityHud, FleetRoster, OperatorCard, CameraControls   glass HUD on theme tokens
 └─ DiveView ── useDiveRenderer ── second WebGLRenderer + three/diveScene.ts
                                    ├─ diveEnvironment.ts  stylised block (storefronts, brownstones)
                                    ├─ diveCast.ts         truck, crew, cones, pothole, roller, ...
                                    └─ diveChoreography.ts  pose everything as a pure function of loop time
```

Most logic lives in pure modules that don't need WebGL, which is how the coverage gate is met:

| Module | What it does |
|---|---|
| `geo.ts` | Mercator projection; scene coordinates are metres around a fixed origin |
| `truckMotion.ts` | Glide between poll positions |
| `repairTimeline.ts` | Phases of the dive-in loop |
| `picking.ts` | Screen-space click picking |
| `mapStyle.ts` | The MapLibre style |
| `three/*` | Scene graphs; three.js builds them without a GPU |

React components and hooks are tested against a fake MapLibre map (`tests/components/mapv2/fakeMapLibre.ts`) and a mocked `WebGLRenderer`.

### 1.4 Behaviour

**City view**

- Opens with an establishing shot: from flat at zoom 9.6 to a tilted overview of all five boroughs. The overview is fitted to the workspace's size (`overviewCamera`: `cameraForBounds` over `NYC_BOUNDS`, plus a zoom gain for the tilt), so Staten Island stays in view whether or not the secondary panel is open. Home returns to it.
- Each borough has its own tint and outline (`mapStyle.ts`), strongest at the overview and fading as you zoom in. The shapes are NYC Open Data's shoreline-clipped borough boundaries, simplified to about 70 KB and served from `public/nyc-boroughs.geojson`.
- The HUD is one row from the top left: the **Fleet** summary, the roster beside it, and the selected vehicle's card to the right of the roster. It wraps when the workspace is narrow.
- Trucks are procedural low-poly models. The body is painted in the activity colour from the classic map's palette (`fleetActivityStyle.ts`), with white stripes.
  - `TRANSIT`: headlight beams, exhaust and spinning wheels. The truck glides to each new poll position.
  - `WORKING`: rotating beacon, a pulse along the ground, and a work zone of cones and two animated crew that unfolds around it.
  - `IDLE`: a breathing halo.
- Selecting a truck (click it, or pick it from the roster) flies the camera to it and draws its last-five-jobs trail.
- "Dive into job" flies the camera down to street level, then routes to `/mapv2/job/:orderId`.

**Dive-in**

- A looping, scripted repair plays on a stylised block. It's labelled illustrative in the UI.
  - Street Condition jobs: arrive → cone off → saw-cut → clear → pour → roll → reopen, about 25 s.
  - Any other complaint type: a generic crew-at-work loop.
- Esc returns to the city.

**Reduced motion and fallbacks**

- With reduced motion, camera moves become instant cuts and the dive-in shows a single still frame.
- Without WebGL2, the page shows a fallback that links to the classic map.

---

## 2. Rollout plan

1. **Now:** Test is on `T1`, Prod is on `C`. Iterate in Test and in mock mode (§6).
2. **Revised 2026-10-17:** the gate for Prod `T2` is §4.2 (context loss), §4.7 (pinned versions) and §4.8 (the pipeline smoke test), all done. Decided against holding it for:
   - §4.1, the error boundary: open, see §8;
   - §4.3, the draw-call budget: left open, not a concern at today's fleet size;
   - §4.6, tile hosting: OpenFreeMap is accepted as stable enough, with no fallback, since the classic map it would fall back to is being removed.
3. Switch Prod to `T2` on Admin → Feature Flags once a pipeline run with the smoke test has passed in Test.
4. Once `T2` has held in Prod, delete the classic map (`FleetMap`, `OperatorTrail`, `FleetMapWidget`, Leaflet), the `T1` path and then the flag, in that order.

---

## 3. Files

| Area | Files |
|---|---|
| Page and routing | `pages/MapV2Page.tsx`, `routes/MapV2TakeoverRoute.tsx`, `routes/FeatureFlagRoute.tsx` (now `onTreatments`), `routes/AppRoutes.tsx`, `mapv2/mapV2Routes.ts` |
| Menu and shell | `shell/menuConfig.ts` (`MenuFlagRule`, `resolveFlaggedLink`, `pathStartsSecondaryCollapsed`), `shell/FlaggedMenuLink.tsx`, `shell/SidebarMenu.tsx`, `shell/WorkspaceShell.tsx`, `shell/shellIcons.tsx` (`CityIcon`); `shell/FeatureGate.tsx` deleted |
| City view | `mapv2/CityView.tsx`, `useCityMap.ts`, `useCityCamera.ts`, `mapStyle.ts`, `fleetOverlays.ts`, `picking.ts`, `geo.ts`, `truckMotion.ts`, `three/fleetLayer.ts`, `three/fleetScene.ts`, `three/truckModel.ts`, `three/crewModel.ts`, `three/props.ts`; shared with the Residents avatars: `components/three/threeKit.ts` (moved 2026-10-17) |
| Dive-in | `mapv2/DiveView.tsx`, `useDiveRenderer.ts`, `JobHud.tsx`, `repairTimeline.ts`, `three/diveScene.ts`, `three/diveEnvironment.ts`, `three/diveCast.ts`, `three/diveChoreography.ts` |
| HUD | `mapv2/CityHud.tsx`, `FleetRoster.tsx`, `OperatorCard.tsx`, `CameraControls.tsx`, `MapV2Glyph.tsx`, `hudStyle.ts`, `WebGlFallback.tsx`; `components/three/webgl.ts` (moved 2026-10-17, shared) |
| Flag | `models/featureTreatment.ts` (`MAP_V2_FLAG`, `MAP_V2_ON`, `MAP_V2_TAKEOVER`), `test-data/featureFlags.ts` |
| Styles | `index.css`: `mapv2-dive-in` keyframe |

---

## 4. Recommended Three.js / WebGL guardrails

These are listed in priority order. None is in place today unless it says so.

### 4.1 Error boundary around anything WebGL

Nothing catches an exception from MapLibre or Three.js. That includes a shader compile failure, a driver bug, or a MapLibre style validation error (one already happened during the build: a nested `["zoom"]` expression). Any of them unmounts the whole page.

- **Add:** a React error boundary around `CityView` and `DiveView` that renders `WebGlFallback`.
- **Under `T2`:** the boundary should also send the user to the classic map.
- **Log it:** capture the error so it's visible.

### 4.2 WebGL context loss — done 2026-10-17

A lost context happens on GPU resets, when a laptop sleeps, or when the browser evicts contexts (Chrome allows about 16 per page).

- **Tested in Chrome** with `WEBGL_lose_context`: MapLibre and three's `WebGLRenderer` both rebuild their own GL state on restore, so no scene teardown is needed.
- **The gap was the city:** it stayed blank until the next interaction, because the fleet layer's repaint loop stopped while the context was gone. `useCityMap` now repaints on `webglcontextrestored` and logs both events.
- **The dive-in** recovered unaided.
- **Still open:** the dive-in creates a second context while MapLibre's stays alive (paused). Consider releasing MapLibre's during a dive, or sharing one.

### 4.3 Draw-call and memory budget

The city view is the biggest performance risk. These counts were measured with a probe test on 2026-10-15:

- One truck plus its work zone is **85 meshes**, so **85 draw calls**. It builds **73 geometries and 82 materials**, none shared between trucks.
- At Test's fleet size of 20 trucks, that's about **1,700 draw calls per frame**, every frame. The fleet layer repaints continuously, even when nothing is moving.
- The dive-in scene is **404 meshes**.

To bring that down:

- **Share geometries and materials** across trucks: build each part once in a module-level kit and reuse it. Note this means `disposeObject` can no longer free them per truck; see §4.4.
- **Use `InstancedMesh`** for repeated parts: wheels, cones, crew limbs, window panes.
- **Level of detail:** below about zoom 14, don't render crew or cones, or show only the truck body. Nobody can see a 1.8 m worker at city scale.
- **Repaint only while something animates.** Today `fleetLayer.render` calls `map.triggerRepaint()` every frame. Throttle to roughly 20 fps for idle-only fleets, or animate only actors on screen.
- **Set a budget and enforce it.** For example, 400 draw calls for the city at 50 trucks, measured from `renderer.info.render.calls` in a dev overlay and asserted in a test.

### 4.4 Disposal discipline

- **Today:** `disposeObject` walks a subtree and disposes every geometry and material. `FleetScene` calls it when a truck leaves the feed, and `DiveScene.dispose` and `useDiveRenderer` call it on unmount.
- **Once resources are shared (§4.3):** per-subtree disposal becomes wrong. Move to reference-counted or kit-owned resources, disposed only when the page unmounts.
- **Add a leak test:** mount and unmount `DiveView` N times and assert that `renderer.info.memory.geometries` and `.textures` return to baseline. This needs a real renderer (§4.8).

### 4.5 No allocation in frame loops

Three.js garbage-collection pauses show up as hitches. Today:

- `fleetLayer.render` allocates a `Matrix4` every frame.
- `sampleMotion` allocates a location object per truck per frame.
- `TruckRig.setActivity` allocates a `Color` on each activity change.

None of these matter at 20 trucks, but the pattern grows with the fleet. Add a lint rule or review checklist item: no `new` inside `render`, `update` or `choreograph` paths; reuse scratch objects instead.

### 4.6 Third-party tiles

The base map comes from **OpenFreeMap** (`tiles.openfreemap.org`): free, no API key, no SLA. If it rate-limits us or goes down, the 3-D city goes blank; the trucks still render on an empty background.

- **Before Prod `T2`:** self-host the tiles (a PMTiles extract of the NYC area on the existing S3 + CloudFront, read with MapLibre's `pmtiles` protocol), or add a fallback style.
- **Keep attribution:** the OpenStreetMap/OpenMapTiles credit is shown and must stay.

### 4.7 Version coupling with MapLibre

`fleetLayer.ts` depends on MapLibre's custom-layer internals:

- `args.defaultProjectionData.mainMatrix`;
- the mercator-plus-`renderingMode: "3d"` contract;
- `renderer.resetState()` to share GL state.

Two more MapLibre-specific workarounds exist:

- **Worker URL:** bundling breaks MapLibre's own lookup of its worker, so `useCityMap.ts` points it at the bundled worker explicitly (`setWorkerUrl` with a `?worker&url` import).
- **Next-frame style load:** MapLibre 6 defers loading the style to the next animation frame, so a hidden tab never loads the map.

Guardrails:

- `maplibre-gl` (6.14.0) and `three` (0.186.1) are pinned to exact versions in `package.json`, both the latest stable (2026-10-17).
- Upgrade them only alongside a real-browser smoke test (§4.8).
- Note: globe projection would break the fleet layer's mercator matrix. Don't enable it without reworking the layer.

### 4.8 Real-browser tests — smoke test added 2026-10-17

All 100+ Mapv2 unit tests run in happy-dom with a fake map and a mocked renderer. They prove the logic, not that anything actually renders.

- **Done:** `web-app/tests/smoke/mapv2.spec.ts` (`npm run test:smoke`, `@playwright/test` 1.63.0) runs headless Chromium with SwiftShader.
  - It waits for the city container's `data-state="ready"` (MapLibre's `load`) and checks that the city's screenshot has real colour variety, not a blank canvas.
  - If a crew is working, it dives into that job and checks the street scene the same way. It skips that part when no crew is working.
  - It runs in the pipeline as `BrowserSmokeTestsTest` (`cdk/pipeline/Nyc311BrowserSmokeTestStep.ts`), a blocking post-step on DeployTest against `test.boroughsim.com`.
  - Locally: `SMOKE_BASE_URL=http://localhost:5180 npm run test:smoke` against the mock server.
- **Original plan, still open:**
  - Load `/mapv2` with the flag on `T1`.
  - Assert that the map's `load` fires and that a frame renders with `renderer.info.render.calls > 0`.
  - Open a dive-in deep link and assert that its canvas renders.
- **Ideally:** add a couple of screenshot comparisons of the dive-in at fixed loop times. Choreography is a pure function of time, so a frame at a given second is deterministic.
- **Where:** run it in the pipeline next to the GET-route integration tests (`4-pipeline-integration-tests.md`).

### 4.9 Bundle budget

The Mapv2 chunk is about **1.5 MB minified (~430 KB gzipped)**, plus a **~500 KB** MapLibre worker. It's lazy-loaded, so the main bundle (about 327 KB) is unaffected.

- **Under `T2`:** this becomes the landing page's critical path.
- **Add:** a size check in CI (e.g. `size-limit`) on the Mapv2 chunk.
- **Consider:** preloading the chunk when `MAP_V2` resolves to `T2`.

### 4.10 Lint and structure rules worth adding

- **Extend `max-lines` to `.ts` modules** under `components/mapv2/three/`. Today it only covers `.tsx`; the three-modules are up to about 170 lines.
- **Keep WebGL objects inside effects:** `new WebGLRenderer` and `new Map` should only appear in hooks that own their dispose (`useDiveRenderer`, `useCityMap`).
- **Never import `three` in a component file** that isn't lazy-loaded, so Three.js can't leak into the main chunk.

### 4.11 Accessibility

- **Canvases are opaque to screen readers.** The roster, the vehicle card and the dive-in HUD carry everything the canvases show, and every camera action has a labelled button.
- **Keep that parity** whenever a feature is added to the canvas, e.g. clicking a job site.
- **Reduced motion:** honoured through `prefers-reduced-motion`. The establishing shot, camera flights and the dive loop all respect it.

---

## 5. Assumptions the frontend makes (revisit these)

### 5.1 Data the fleet API doesn't give us

The fleet feed (`GET /fleet/locations`, `fleetLocation.ts`) is a point-in-time snapshot: activity, GPS position, the last five job locations, and the current order's id, complaint type and address. Mapv2 makes these assumptions on top of it:

- **Motion is invented within limits.** Trucks glide in a straight line from their drawn position to each new poll position, taking 1.5–9 s at about 14 m/s. They never follow roads.
- **Heading is guessed:** from the last job to the current position, then along each glide.
- **What would make it real:** route polylines, heading and ETA from the backend would give honest motion.
- **In-transit trucks don't show where they're going.** The current order's address has no coordinates in this API. Adding `current_order.location` (lat/lng) would allow a route line to the destination.
- **The work zone appears around the truck whenever it's `WORKING`.** That assumes a working truck is parked at its job site.
- **The dive-in is not live.** The API doesn't expose which stage a job is at, only that a crew is working. The repair loop and its step tracker are a script, labelled "Illustrative animation" in the UI. Exposing an order stage (e.g. `SECURING`, `REPAIRING`, `CLOSING`) would let the step tracker tell the truth.
- **One script per complaint type.** `scriptFor` matches the exact string `"Street Condition"`. There's no descriptor (pothole vs. cave-in vs. defective hardware) in the fleet feed, so every street job plays the same pothole repair. A descriptor field, plus scripts keyed by an enum rather than display text, would fix both.
- **Dive-in links go stale.** `/mapv2/job/:orderId` resolves only while some Operator's `current_order` matches. Once the job completes, the link shows "This job isn't active right now". A per-order read endpoint would let finished jobs show their outcome.
- **"Live" is cosmetic.** The HUD's live dot doesn't detect stale data; it stays lit when polls fail (only the error banner shows). Base it on the query's `dataUpdatedAt`.

### 5.2 Geography and scale

- **Fixed origin.** The scene origin is fixed near Midtown (`geo.ts`, `NYC_CENTER`), and scene coordinates are float32 metres from it. That's fine across the five boroughs. If the service area ever grows much wider, re-centre the origin per view.
- **Exaggerated trucks.** Trucks render at least 44 px long on screen, so they're far bigger than life when zoomed out. Scale is per frame and uniform; the work zone scales with them.
- **No buildings when zoomed out.** OpenMapTiles only carries buildings from tile zoom 13, so the zoomed-out overview has no 3-D buildings until you zoom in.
- **Approximate picking.** Clicks select the truck whose anchor point is within 34 px on screen, not the actual mesh. Overlapping trucks (e.g. several idle at one depot) select the nearest anchor.

### 5.3 Theming

- **Hard-coded palettes.** Map and dive-in colours are hard-coded per theme (`mapStyle.ts` `PALETTES`, `diveEnvironment.ts` `MOODS`), separate from the CSS design tokens.
- **Theme switches rebuild.** A theme switch reloads the MapLibre style with `diff: false` and rebuilds the dive-in scene, which restarts its loop. Deriving the palettes from the tokens would keep them in step.

### 5.4 Flag and shell behaviour

- **T2 users may see a flash of the classic map.** `MapV2TakeoverRoute` shows the classic map while the flag loads, so `C`/`T1` users never wait on it. The trade-off: a `T2` user landing on `/` may briefly see Leaflet before the redirect. If that matters, hold `/` blank until the flag resolves.
- **No-WebGL users under T2.** Without WebGL2 the classic map still works at `/`, but the sidebar has hidden its entry. The logo link still reaches it.
- **One Map entry under T2.** It's labelled "Map" with the classic map's icon, and still points at `/mapv2` until the cleanup in §2.
- **One clock, browser time.** Animation runs on `performance.now()`. Poll glides are timed from when the poll arrives, not when the GPS fix was taken.

---

## 6. Working on it locally

- **Live (Test):** your normal dev server on **port 5173**; it's the only local origin the API's CORS allows. Test's fleet is often all `IDLE`, which leaves nothing to dive into.
- **Mock mode:** working and in-transit trucks with orders, no API calls:
  ```
  cd web-app && VITE_DATA_MODE=mock npx vite --port 5180
  ```
  Then open `http://localhost:5180/mapv2`. Mock flags default `MAP_V2` to `T1`. To try `T2`, change its `default_treatment` in `src/test-data/featureFlags.ts` locally, and don't commit that.
- **Visual checks in an automated browser:** the window must be visible. A hidden tab pauses `requestAnimationFrame`, and MapLibre 6 won't even load its style.
- **Production build locally:** your `.env.local` sets `VITE_RESIDENT_DATA_MODE=mock`, which trips the live-bundle guard. Build the way the pipeline does:
  ```
  VITE_DATA_MODE=live VITE_RESIDENT_DATA_MODE=live npm run build
  ```
  This is unrelated to Mapv2.

---

## 7. Follow-up checklist

- [ ] Error boundary around `CityView`/`DiveView` (§4.1, see §8)
- [x] WebGL context-loss recovery (§4.2)
- [ ] Shared geometries/materials, instancing, LOD and idle repaint throttling; a draw-call budget test (§4.3)
- [ ] A disposal leak test with a real renderer (§4.4)
- [ ] No per-frame allocation in the render/update paths (§4.5)
- [ ] ~~Self-hosted PMTiles for the base map (§4.6)~~ Decided against 2026-10-17: OpenFreeMap is accepted
- [x] Pin `maplibre-gl` and `three` to exact versions (§4.7)
- [x] A Playwright + SwiftShader smoke test in the pipeline (§4.8)
- [ ] A bundle size check on the Mapv2 chunk (§4.9)
- [ ] Lint: `max-lines` on `mapv2/three/*.ts`; renderer and map construction confined to hooks (§4.10)
- [ ] API: `current_order.location`, an order stage/progress field and a complaint descriptor in the fleet feed (§5.1)
- [ ] A "Live" indicator driven by data freshness (§5.1)
- [ ] Palettes derived from the theme tokens (§5.3)
- [ ] Once `T2` holds in Prod, remove the classic map, then `T1`, then the flag (§2)

---

## 8. Pre-T2 pass (2026-10-17)

- **Context loss (§4.2):** the city repaints on restore; tested in Chrome.
- **Versions (§4.7):** pinned.
- **Smoke test (§4.8):** in the pipeline.
- **UI:**
  - The T2 menu entry is "Map" with the classic map's icon.
  - The HUD title is "Fleet", and the summary card is wider so "In transit" fits on one line.
  - The roster sits right of the summary, and the vehicle card right of the roster.
  - Home fits all five boroughs.
  - The boroughs are tinted and outlined.
  - The secondary panel opens by default.
  - Trucks are painted in their activity colour.
- **Error boundary (§4.1), still open:**
  - What it covers: errors React sees, i.e. ones thrown while rendering or inside an effect. That includes `new Map(...)` or `new WebGLRenderer(...)` failing to create a context (the WebGL2 probe passed, but the real context fails, e.g. past Chrome's ~16-context limit) and a scene build throwing. Today any of these unmounts the whole app: there's no error boundary anywhere in the web-app, so the page goes white, sidebar included.
  - What it doesn't cover: errors inside MapLibre's or the dive's frame loop (`requestAnimationFrame`). A boundary never sees those; they freeze the canvas, but the page stays up.
