---
name: create-resident
description: Adds one new simulated resident to the customer side (13-customer-simulation.md) end to end - drafts the persona from a one-line concept, gets the user's approval, then writes the seed JSON, registers it, hand-authors its Three.js model, updates the roster-pinned tests, mocks and docs, runs the Operational Loop in customer/backend, cdk and web-app, and (optionally) ships it through the pipeline's DeployCustomer stage and verifies it in Prod. Use whenever the user asks to create, add or recruit a resident or persona. Run once per resident; when adding several, author them all and ship once.
---

# Create a Resident

A resident is a seed file plus a hand-authored 3-D model. Nothing is
created by hand in AWS: the seed sync (`Custom::ResidentSeedSync`) writes
the resident's `CURRENT` and `V#0001` rows on deploy, and the stack makes
one EventBridge schedule per seed. Residents are **Prod only**, in
`Nyc311Customer-Prod`, deployed by the pipeline's `DeployCustomer` stage
after `DeployProd`.

Background, if needed: `docs/13-customer-simulation.md` §2 customer side
(decisions 1–3, 7), §3 Flow B, Appendix B (roster), O (build) and P
(model style guide).

## Inputs

The user gives a concept, e.g. "a Staten Island school-bus driver who
hates detours". Everything else is derived and then proposed. If no
concept is given, ask for one; don't invent the archetype unprompted.

## Step 1 — Read the current roster

Read every `customer/backend/residents/*.json` and
`web-app/src/components/residents/models/residentModels.ts`. Note what is
already taken: names, boroughs, schedule slots, dial positions, skin and
clothing colours, and silhouette features (hats, glasses, hair). A new
resident should **fill a gap**, not repeat one.

## Step 2 — Draft the persona (no files yet)

Draft every seed field, using the rules below, and show it to the user as
one block: the seed JSON plus a two-line description of the model's
look. **Wait for approval or edits before writing anything.** The persona
prompt is creative content the user owns.

**Identity**
- `name`: a tree or shrub codename in the roster's style (Sycamore,
  Hawthorn, Juniper). One word, title case, unused. **Never `Oak`**:
  tests use `oak` as the unknown resident.
- `persona_id`: the name lowercased (`^[a-z][a-z0-9-]*$`). It is the
  file name, the `model_key`, the schedule name and the DynamoDB key.
- `tagline`: one line on who they are, about 60 characters, like the
  existing ones.
- `backstory`: two sentences, concrete and local (a street, a bus
  route, a job detail), explaining why streets matter to them.
- `persona_prompt`: starts `You are <Name>, …`, three to five sentences:
  who they are, their temperament, what they notice, how they relate to
  the city. Second person, plain English. It is combined with the
  standard instructions in `customer/backend/service/resident/ideaPrompt.ts`,
  so it doesn't explain BoroughSim or the tools.
- Make an archetype from a job, a situation and a temperament. Don't
  make a caricature of ethnicity, nationality, religion, disability
  or similar. No real people, businesses or agencies by name. Call the
  system "BoroughSim", never "the bureau".

**Dials** (all integers 0–100 unless noted)
- `demeanor.{patience, hostility, verbosity}`: should follow from the
  prompt. Spread the roster across the range; avoid a near-copy of an
  existing resident's three dials.
- `activity_level`: the chance that a scheduled thought becomes an
  idea. Keep it within 10–40 (the existing three are 15–35).
- `follow_up_propensity`: high means they chase one problem for weeks;
  low means they jump between problems.
- `active_hours: { start, end }`: New York hours 0–23, and `start > end`
  wraps past midnight. Nothing reads it yet (Appendix R, "leftover
  dials"), but set it to fit the character.
- `idea_type_weights`: all six keys (`STATUS_CHECK`, `SERVICED_CHECK`,
  `ETA_REQUEST`, `PRIORITY_INQUIRY`, `ESCALATION`, `FEATURE_REQUEST`),
  **summing to 100**, shaped by the character (a hostile resident
  escalates more; a tech-comfortable one asks for features more).

**Interests**
- `interests.boroughs`: exactly `BROOKLYN`, `QUEENS`, `BRONX`,
  `MANHATTAN` or `STATEN ISLAND` (with a space, as in the order data;
  checked 2026-10-25), usually one. The idea worker samples open
  orders by this value, so a misspelling silently gives the resident
  nothing to think about. Cover boroughs nobody has yet before
  doubling up. Open orders on 2026-10-25: Manhattan 205, Queens 202,
  Brooklyn 188, Bronx 73, Staten Island 30, so a Staten Island
  resident will see the same few orders often.
- `interests.descriptors`: three or four values taken **exactly** from this
  list (the order `descriptor` values):
  `Pothole`, `Cave-in`, `Hummock`, `Depression Maintenance`,
  `Rough, Pitted or Cracked Roads`, `Failed Street Repair`,
  `General Bad Condition`, `Wear & Tear`, `Blocked - Construction`,
  `Dumpster - Construction Waste`, `Unsafe Worksite`,
  `Defective Hardware`, `Guard Rail - Street`, `Crash Cushion Defect`,
  `Line/Marking - Faded`, `Line/Marking - After Repaving`,
  `Plate Condition - Anti-Skid`, `Plate Condition - Noisy`,
  `Plate Condition - Open`, `Plate Condition - Shifted`.
  (Source: `backend/service/scheduling/streetConditionProcessingTimeService.ts`.)

**Fixed for now**
- `model_id`: `"amazon.nova-micro-v1:0"`, the same model as everyone
  else. A different model changes the idea worker's Bedrock IAM grant
  and a stack test pins one model, so only change it if the user asks.
- `model_key`: the `persona_id`.
- `action_buckets: ["REQUESTS", "FEATURE_REQUESTS"]` and `action_weights`
  for `SEARCH_REQUESTS`, `CREATE_FEATURE_REQUEST` and
  `GET_FEATURE_REQUEST` (each above 0, set from the personality: 60+
  reaches for it first, 30–59 uses it when it fits, below 30 rarely), with
  `BROWSE_WEBSITE: 0`. A test requires every resident to be granted both
  buckets (docs/16-resident-action-models.md §5.1).

**Schedule**: every resident thinks every 3 hours, New York time:
`cron(<minute> <offset>/3 * * ? *)`. Take the first free slot in this
fill order, so that thoughts stay spread across each 3-hour cycle:

| Fill order | Slot (minute, offset) | Taken by |
|---|---|---|
| 1–3 | `(0, 0)`, `(0, 1)`, `(0, 2)` | Hawthorn, Juniper, Sycamore |
| 4–6 | `(30, 0)`, `(30, 1)`, `(30, 2)` | Ginkgo, Ailanthus, Hornbeam |
| 7–12 | `(15, 0)`, `(45, 0)`, `(15, 1)`, `(45, 1)`, `(15, 2)`, `(45, 2)` | Yellowwood, Sassafras, Dogwood, Pine-ter Parker, —, — |

Update the "Taken by" column in this file when a slot is used.

**Look** (for the model, Step 4): a build (`SLIGHT`/`AVERAGE`/`BROAD`),
a height of 0.9–1.1, a skin tone, a top/bottom colour pair, and **one
silhouette feature that reads at 32 px** (a hat, hair shape, glasses,
a hood, a prop), different from every existing resident's. Vary skin
tones and builds across the roster.

## Step 3 — Write the seed (customer/backend)

1. `customer/backend/residents/<persona_id>.json`, with the same field
   order and formatting as `sycamore.json`. The schema is strict
   (`customer/backend/models/resident.ts`): no extra keys.
2. Add the import and array entry in
   `customer/backend/service/resident/residentSeeds.ts`, keeping the list in
   alphabetical order. (`residentSeeds.test.ts` fails if a file is
   missing from it.)

## Step 4 — Write the model (web-app)

Follow Appendix P's style rules. Use the closest existing model as the
template (`sycamore.ts` for glasses or a hat, `juniper.ts` for a
helmet or sash, `hawthorn.ts` for an apron).

1. `web-app/src/components/residents/models/<persona_id>.ts` exporting
   `build<Name>(): ResidentRig`: start from `buildFigure({...})`, then
   add hair (`hairCap`), clothing and the silhouette feature to
   `rig.head` / `rig.torso`, using only `threeKit` helpers (`box`,
   `mesh`, `solid`, `place`). Line glasses up with `EYE_HEIGHT` /
   `EYE_SPACING`. A block comment at the top names the seed file and
   describes the look, as the existing files do.
2. Colours come from `residentPalette.ts` only (lint rejects hex literals
   anywhere else). If the look needs a colour the palette lacks, add one
   **muted** entry to the right group in `residentPalette.ts`. A resident
   gets at most one bright note.
3. Register it in `residentModels.ts`, keeping alphabetical order.
4. Limits enforced by lint/tests: at most 120 lines per file, between 100
   and 3,000 triangles, palette colours only, a full rig.

## Step 5 — Update what pins the roster

These files list the residents by hand and must change with each one:

| File | Change |
|---|---|
| `cdk/tests/customer/residentSync.test.ts` | Add the id (sorted) to the `personaIds` expectation, and its cron at the same index in the `schedule` expectation |
| `cdk/tests/customer/Nyc311CustomerStack.test.ts` | Add the id to the persona loop; bump `resourceCountIs("AWS::Scheduler::Schedule", N)` |
| `web-app/src/test-data/residentPersonas.ts` | Append a `ResidentPersona` entry (the seed's display fields, `version: 1`, `idea_count: 0`, `last_idea_at: null`) so mock mode shows the resident and their model |
| `web-app/tests/components/residents/PersonaPanel.test.tsx` | The card count `toHaveLength(3)` must match the mock roster; set it to `MOCK_RESIDENT_PERSONAS.length` instead of another literal |
| `docs/13-customer-simulation.md` Appendix B | Add a roster row: codename, who, dials, the `persona_prompt` |

Then search for anything else that counts or lists residents:
`grep -rn "hawthorn\|juniper\|sycamore" web-app/tests cdk/tests customer/backend/tests`.
Mock ideas (`residentIdeas.ts`) aren't required for a new resident.

## Step 6 — Operational Loop (CLAUDE.md §2)

Run in all three packages, after the last change:

```
cd customer/backend && npm run build && npm run lint && npm run test:coverage
cd cdk && npm run build && npm run lint && npm run test:coverage
cd web-app && npm run build && npm run lint && npm run test:coverage
```

All must pass with at least 90% coverage per file. `cdk` tests read the
real seed files at synth time (`loadResidentSeeds`), so a bad seed
shows up there too.

**Look at the model.** Start the web-app with
`VITE_RESIDENT_DATA_MODE=mock npm run dev`, open the Residents page
(`CUSTOMERS_TAB` must be on) and check the new resident's avatar and
waving stage, using the `run` skill or a Chrome screenshot. Fix
anything that doesn't read at avatar size (Appendix P rule 5) before
going further. Show the user the screenshot.

## Step 7 — Ship (optional; ask first)

When several residents are being added, **author them all (Steps 1–6
each), then ship once**: every pipeline run costs CI money (#112).

1. Commit everything as one commit (CLAUDE.md §7), e.g.
   `[feat] - Recruit resident <Name>: <tagline>`, and push to `main` only
   after the user confirms.
2. Poll `Nyc311Pipeline` with Monitor until the `DeployCustomer` stage of
   this execution succeeds or any stage fails. (`ship-and-verify`'s
   `poll_pipeline.py` stops at `DeployTest`, which is too early for this.)
   Report stage changes as they happen.
3. Verify in Prod (read-only, `--profile nyc311 --region us-east-1`):
   - `aws scheduler get-schedule --name CustomerResident-<persona_id>-Prod`
     shows the expected cron, `ENABLED`;
   - `curl -s https://customer-api.boroughsim.com/residents/<persona_id>`
     returns the resident at `version: 1` with `model_key` set;
   - boroughsim.com's Residents page shows the model.
4. Optionally force a first thought. This writes a real idea to Prod, so
   **confirm with the user immediately before running it** (CLAUDE.md §3):
   `aws lambda invoke --profile nyc311 --region us-east-1 --function-name CustomerIdeaWorker-Prod --cli-binary-format raw-in-base64-out --payload '{"persona_id":"<persona_id>","force":true}' /dev/stdout`.
   Report what came back: an idea, or `nothing_to_say`.

## Don'ts

- Don't write residents into DynamoDB by hand, or bump `version` in a
  seed: the sync assigns versions from the content hash.
- Don't delete or rename an existing seed to "replace" a resident.
  Removing a file never deletes the resident, and their ideas still
  point at it.
- Don't edit `ideaPrompt.ts` as part of adding a resident: a prompt
  change re-versions every resident.
- Don't deploy with `cdk deploy`; the customer stack ships only through
  the pipeline.
