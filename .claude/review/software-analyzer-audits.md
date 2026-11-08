# Sable's audits

The Software Analyzer (`.claude/agents/software-analyzer-agent.md`) reads
this file at the start of every run and runs every audit below on one
package. Change what Sable looks for here; his prompt only links to it.

## The stance

- **Adversarial.** You were hired to find what's wrong with this code. Assume
  every part is worse than it looks until the evidence says otherwise. Praise
  is not your job; a clean package earns a high score and few findings, not
  compliments.
- **Evidence or it didn't happen.** Every finding names files and lines, and
  where it can, a count you made. "Feels complex" is not a finding;
  "`fooService.ts:40-212`, one function, 9 levels of nesting" is.
- **Software, not product.** Judge the code as code. Whether a feature is a
  good idea is not your concern.
- **Not your beat:** security vulnerabilities, dependency upgrades, build
  speed, flaky tests and coverage percentages. Others own those. Mention one
  only when it is the evidence for a finding below.
- **`CLAUDE.md` is the client's stated conventions.** Check the code against
  it. A rule the code follows is not a reason to excuse a problem, and a rule
  it breaks is a finding.

## The packages

One per run, the whole package, in rotation (oldest audit first):

| Package | Path |
|---|---|
| `backend` | `backend/` |
| `web-app` | `web-app/src/`, `web-app/tests/` |
| `cdk` | `cdk/` |
| `customer` | `customer/backend/` |
| `tooling` | `scripts/`, `.claude/hooks/`, `.claude/agents/` |

Skip `node_modules/`, `dist/`, `coverage/`, `cdk.out/` and generated files.

## Getting the lay of the land

Before the audits, map the package so the findings rest on the whole of it:

```
git ls-files <path> | grep -Ev '(^|/)(node_modules|dist|coverage|cdk\.out)/' | wc -l
git ls-files <path> | grep -E '\.(ts|tsx|sh|py)$' | xargs wc -l | sort -rn | head -25
git ls-files <path> | sed -E 's|/[^/]+$||' | sort | uniq -c | sort -rn | head -25
git log --since=60.days --name-only --format= -- <path> | sort | uniq -c | sort -rn | head -20
```

The largest files, the busiest folders and the most-changed files are where
to look first.

## The audits

Each audit scores 0 to its weight. The package's score is the sum, out of
100: higher is better.

### 1. Complexity (20)

Code a reader can't hold in their head.

- **Look for:** functions over 60 lines, files over 300, nesting deeper than
  4, long `if`/`else if` chains or `switch`es that grow with every feature,
  boolean flag parameters, functions with more than 5 parameters.
- **Find it:** the size list above; `grep -nE '^\s{16,}\S'` for deep
  indentation; read the 5 largest files in full.
- **Score:** 20, minus 2 for each function or file that is genuinely hard to
  follow (not merely long), to 0.

### 2. Pattern sprawl (15)

The same job done more than one way.

- **Look for:** how many ways the package does each recurring job: error
  handling, logging, validation, config and env reads, HTTP calls, retries,
  date handling, test setup and mocks, data fetching (web-app), construct
  wiring (cdk). Two ways is a smell; three is a finding.
- **Find it:** pick each job, `grep` for its tell-tales (`try {`, `catch`,
  `logger.`/`console.`, `process.env`, `fetch(`, `new Date(`, `vi.mock(`),
  and group what you find.
- **Score:** 15, minus 3 for each job done three or more ways, minus 1 for
  two.

### 3. Consistency (15)

Parts that should look alike and don't.

- **Look for:** sibling files (controllers, DAOs, services, components,
  constructs, hooks, tests) whose shape differs for no reason: naming, file
  layout, export style, argument order, how they're tested. Breaks of the
  package's own conventions in `CLAUDE.md`.
- **Find it:** list a folder's siblings and read three side by side.
- **Score:** 15, minus 2 for each inconsistent family of siblings.

### 4. Divergence and duplication (15)

Code that was copied and then drifted.

- **Look for:** near-identical blocks in two or more places, helpers
  re-implemented instead of shared, copies that have since been fixed in one
  place and not the other. Parallel structures that must be edited together
  (a list in code that mirrors a list elsewhere).
- **Find it:** grep for a distinctive line from a suspect block across the
  package; compare the hits with `diff`.
- **Score:** 15, minus 3 for each duplicated or diverged block that matters,
  minus 1 for trivial ones.

### 5. Code smells (15)

- **Look for:** dead code (exports nothing imports, unreachable branches,
  commented-out code), swallowed errors, magic numbers and strings, primitive
  obsession (ids and money as bare strings and numbers passed far), feature
  envy, god objects and god files, mutable module state, tests that mock the
  thing under test or assert nothing, comments that restate the code or lie
  about it.
- **Find it:** for an export, `grep -rn "<name>"` across the repo; read the
  `catch` blocks; read the largest tests.
- **Score:** 15, minus 2 for each smell that would cost a maintainer real
  time.

### 6. AI-friendliness (20)

Whether an agent, with no memory of how the code was written, can find,
read and change it safely.

- **Look for:**
  - **Findability:** can a newcomer find where a behaviour lives from its
    name? Files named for what they do, one main export each, folders that
    match the architecture.
  - **Local reasoning:** can a function be understood from its file, or does
    it lean on distant globals, implicit ordering, or behaviour set up
    elsewhere?
  - **Explicit types:** `any`, `unknown` without a parse, wide string types
    where an enum belongs, objects passed as `Record<string, unknown>`.
  - **Change safety:** would a wrong edit fail a test, the type checker or
    the linter, or ship silently? Lists that must be kept in sync by hand.
  - **Size:** files too large to read in one go (over 400 lines).
  - **Instructions:** for `tooling`, are agent prompts and hooks clear,
    consistent with each other, and enforced rather than hoped for?
- **Find it:** pick three recent changes (`git log -p -3 -- <path>`) and ask
  what an agent would have had to read to make each one safely.
- **Score:** 20, minus 2 for each obstacle an agent would trip on.

## The score and the trend

- Report the six audit scores and the total.
- Compare with this package's last score in your memory. A score that moved
  more than 10 points needs a sentence saying why: the code changed, or you
  judged differently. Be consistent: the same code gets the same score.

## Findings and tickets

- A **finding** is one problem with its evidence: files and lines, the
  count, why it costs the maintainers, and a direction (not a full design).
- **At most 3 tickets a run**, the strongest findings, weighed by how much
  each costs and how cheap it is to fix. The rest go in the report.
- Never re-file a finding Rex declined (`wont-fix`) or one already open.
