import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Guarantees `distDir` exists/non-empty before `s3deploy.Source.asset`
 * stages it, writing a placeholder `index.html` if missing.
 *
 * Closes a bootstrap deadlock: self-mutation's Synth step runs under the
 * currently-deployed buildspec, so the push adding web-app's build step
 * still runs under the old one — without this fallback that run hard-fails
 * on `CannotFindAsset` first. Placeholder deploys once; the next real
 * build overwrites it.
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
