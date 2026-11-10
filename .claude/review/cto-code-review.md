# Rex's code review rubric

The CTO agent (`.claude/agents/cto-agent.md`) reads this file at the start of
every run and applies it to every diff. Change how Rex reviews here; his
prompt only links to it.

## The bar

- **Approve by default.** A PR that is correct, passes its gates and follows
  the project rules is approved, even if you'd have written it differently.
- **At most 3 blocking comments per review**, the most important first. If you
  find more, keep the 3 that matter most and name the rest in one line of the
  review body.
- **No nits.** Naming taste, formatting a linter doesn't enforce, and
  "consider" ideas are suggestions at most: one line, optional, never inline.
- On a later round, judge whether your earlier blocking comments were fixed,
  and look for new problems only in what changed since.

## Blocking

1. **The gates fail.** Build, lint or `test:coverage` fails in a touched
   package, or a touched file is under 90% coverage (CLAUDE.md §2).
2. **It's wrong.** A bug, an unhandled error path, a race, a broken contract
   with a caller, or a test that passes without testing the change.
3. **Project rules** (CLAUDE.md):
   - a controller importing a DAO, or a bundle importing another bundle (§5.2);
   - `any`, or a trust boundary without a zod parse (§5.1, §5.2);
   - a module-scope DAO or client (§5.2);
   - `//` comments or comment prose over 500 characters (§6.1);
   - a named AWS resource without the env suffix (§5.3);
   - enum values not `ALL_CAPS` (§6);
   - a public API change that skips `.claude/API.md` (§6.2);
   - a component over 200 lines (§5.1).
4. **Security and cost.** A secret or token in code or logs, a wider IAM grant
   than the change needs, an unbounded scan or loop over a table, or a resource
   that bills by the hour added without a reason.
5. **Scope.** The PR does something its description doesn't say, or touches
   `main`-only workflow files (`.claude/`, `scripts/`, the pipeline) without
   saying why.

## Code smells to name (blocking only when they cause one of the above)

- duplicated logic that already exists in a shared helper;
- dead code, or a test or flag left behind;
- swallowed errors, or logging that drops the context a debugger needs;
- tests that mock the thing under test, or assert on implementation details;
- a dependency added for something a few lines would do.

## Kid Kestrel's PRs (`gen-purpose-dev/`): the stricter bar

His work reaches residents behind flags, so "approve by default" doesn't
apply. Approve only when you have checked each of these yourself, and block
on any that fails:

1. **No code smells.** Every smell in the list above is blocking on his PRs,
   not just a name.
2. **No bugs.** Read every changed path, including error, empty and
   boundary cases, and each caller of a changed function.
3. **Nothing existing breaks.**
   - With the flag at `C`, behaviour is exactly what it was: the old path is
     untouched or provably equivalent.
   - No existing test is removed, skipped or weakened (a looser assertion,
     a wider mock).
   - Tests cover both treatments, `C` and `T1`.
4. **It's the leg the spec says.** The PR matches its leg's row in
   `docs/kid-kestral/<issue>-<slug>.md`: nothing from a later leg, nothing
   left out.

The 3-comment cap and rounds still apply.

## Writing a comment

- Point at the line. Say what's wrong, why it matters and what would fix it,
  in two or three sentences.
- One problem per comment.
- Plain and kind. No flavour.
