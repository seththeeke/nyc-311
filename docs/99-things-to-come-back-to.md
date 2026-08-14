# Things to Come Back To

Running list of items deliberately deferred — not forgotten, just not worth
blocking current work on. No fixed format required per entry; enough
context to pick it back up later is the only bar.

---

## Pipeline metrics and build-time optimization

The `Synth` CodeBuild step (`cdk/pipeline/Nyc311PipelineStack.ts`) feels
slow. Likely causes, unconfirmed:

- No dependency caching — `npm ci` runs fresh for both `backend/` and
  `cdk/` on every execution.
- No `computeType` override on `codeBuildDefaults.buildEnvironment`, so it
  defaults to the smallest (`BUILD_GENERAL1_SMALL`).
- `backend/` and `cdk/` lint/test/coverage run sequentially in one shell
  script, even though they're independent and could run in parallel
  CodeBuild actions.

Where to check before acting: CodePipeline console → `Nyc311Pipeline` →
an execution → `Synth` action → "Details" → CodeBuild build page →
"Phase details" for per-run timing; CloudWatch → `AWS/CodeBuild` namespace
→ `Duration` metric (by project) for the trend over time.
