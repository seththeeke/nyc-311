---
name: log-backlog-item
description: When asked to log an item not to forget about, run this skill to file it as a GitHub issue labelled backlog, the project's one backlog.
---

# Log Backlog Item

The backlog is GitHub issues labelled `backlog` — nothing else. The issue
holds the full context; there is no local file to keep in sync.

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
   `gh label create backlog --repo seththeeke/nyc-311 --color 0E8A16 --description "Deferred work, tracked as GitHub issues"`.

## Logging a new item

1. Search first, so the item isn't a duplicate:
   `gh issue list --repo seththeeke/nyc-311 --state all --label backlog --search "<keywords>"`.
   If an issue already covers it, comment on that issue instead.
2. Draft a title (short, specific) and a body with enough context for
   someone else to pick this up later without re-deriving it: what, why and
   where to look.
3. Write the body to a temp file (avoids shell-quoting problems with
   multi-line markdown) and create the issue:
   ```
   gh issue create --repo seththeeke/nyc-311 --title "<title>" \
     --body-file <tmp-body-file> --label backlog
   ```
   Add one more `--label` per extra label the caller asks for (e.g. an
   agent's own label and `feature-request` or `bug`). `gh issue create`
   prints the issue URL; the number is its last path segment.
4. Report the created issue URL back to the user.

## Conventions

- Label every issue this skill creates with `backlog`.
- An agent filing for itself starts the body with its own marker line (e.g.
  `<!-- cpo-agent -->`) and says who filed it, since every agent posts with
  the repo owner's account.
- Close an item by closing its issue, with a comment saying why.
