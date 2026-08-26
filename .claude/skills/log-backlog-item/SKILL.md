---
name: log-backlog-item
description: When asked to log an item not to forget about, run this skill to track and sync the change as a local item and a ticket within Github to track against.
---

# Log Backlog Item

Keeps `docs/99-things-to-come-back-to.md` and GitHub issues in sync. The
GitHub issue is the source of truth for full context; the doc is a short,
scannable index that links to it — never duplicate the full write-up in
both places.

Repo: `seththeeke/nyc-311`. Always pass `--repo seththeeke/nyc-311`
explicitly to every `gh issue`/`gh label` command in this skill rather than
relying on the invocation directory's git remote.

## One-time setup (skip once verified working)

1. Confirm `gh` is installed: `gh --version`. If missing: `brew install gh`.
2. Confirm authenticated: `gh auth status`. If not logged in, this is an
   interactive browser OAuth step only the user can complete — ask them to
   run `gh auth login --hostname github.com --git-protocol ssh --web`
   themselves (suggest `! gh auth login ...` if they want to run it inline).
   Do not attempt to script or automate this step.
3. Confirm the `backlog` label exists:
   `gh label list --repo seththeeke/nyc-311 --search backlog`. If missing:
   `gh label create backlog --repo seththeeke/nyc-311 --color 0E8A16 --description "Deferred work tracked in docs/99-things-to-come-back-to.md"`.

## Logging a new item

1. Draft a title (short, specific) and a body with enough context for
   someone else to pick this up later without re-deriving it — what/why/
   where to look — matching the bar the existing doc entries set.
2. Write the body to a temp file (avoids shell-quoting problems with
   multi-line markdown) and create the issue:
   ```
   gh issue create --repo seththeeke/nyc-311 --title "<title>" \
     --body-file <tmp-body-file> --label backlog
   ```
   `gh issue create` prints the issue URL on success; parse the issue
   number from it (last path segment).
3. Append a new section to the end of `docs/99-things-to-come-back-to.md`,
   matching the existing `## <heading>` + `---` separator pattern:
   ```
   ## <title>

   See [#<number>](<url>).

   ---
   ```
   Add at most one extra sentence of framing only if the title alone
   doesn't convey what's blocked/deferred and why — otherwise the link
   line is enough; full context lives in the issue.
4. Report the created issue URL back to the user.

## Migrating an existing doc entry into an issue

Used when a doc entry currently holds full freeform prose instead of a
link (e.g. a one-time backfill of older entries).

1. Take the section's `## heading` as the issue title and everything
   between that heading and the next `---` as the issue body, verbatim.
2. Create the issue the same way as "Logging a new item" step 2.
3. If the section is already marked resolved in its text (e.g. starts
   with "**Resolved <date>**"), close the issue right after creating it
   so GitHub reflects the doc's real state:
   `gh issue close <number> --repo seththeeke/nyc-311 --comment "Resolved <date> — see linked doc/commit history for details."`
4. Replace the section's body in the doc with the same short link form
   used for new items (heading kept as-is, body replaced).
5. When migrating multiple entries in one pass, create all the issues
   first, then do a single rewrite of the doc — a half-migrated file
   (some entries linked, others mid-edit) is worse than doing all the
   `gh issue create` calls up front and rewriting once.

## Conventions

- Label every issue this skill creates with `backlog`.
- Doc entries are an index: a heading plus a link (plus at most one
  sentence). The issue is where the real detail lives.
- Preserve the doc's existing structure (`## heading` sections separated
  by `---`) — this skill only changes what's *inside* a section, not the
  file's overall shape.
