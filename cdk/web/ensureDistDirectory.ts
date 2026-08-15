import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Guarantees `distDir` exists and is non-empty before `s3deploy.Source.asset`
 * stages it, by writing a placeholder `index.html` if it's missing or empty.
 *
 * Real gap this closes: a self-mutating pipeline's Synth step runs under
 * whatever buildspec is *currently deployed*, not the one in the commit
 * being synthesized — so the push that first adds `web-app/`'s build step
 * to the Synth `ShellStep` (`Nyc311PipelineStack.ts`) still executes under
 * the *old* buildspec for that one run, which never builds `web-app/` at
 * all. Without this fallback, that run's `cdk/` unit tests (and `cdk
 * synth`) hard-fail on `CannotFindAsset` before self-mutation ever gets a
 * chance to adopt the new buildspec — a bootstrap deadlock. The same gap
 * applies locally before a developer's first `web-app` build. The
 * placeholder deploys once, harmlessly; the next run that actually builds
 * `web-app/` first (which self-mutation guarantees for every run after
 * this one) overwrites it with the real bundle.
 */
export function ensureDistDirectory(distDir: string): void {
  if (fs.existsSync(distDir) && fs.readdirSync(distDir).length > 0) {
    return;
  }

  fs.mkdirSync(distDir, { recursive: true });
  fs.writeFileSync(
    path.join(distDir, "index.html"),
    "<!doctype html><title>NYC 311</title><p>Deploying…</p>"
  );
}
