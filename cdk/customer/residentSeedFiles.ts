import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { CUSTOMER_RESIDENT_SEEDS_DIR, CUSTOMER_RESIDENT_SYNC_INPUTS } from "./customerBackendRoot";

/*
 * What the stack needs from the resident seeds at synth time: one
 * schedule per resident and the Bedrock models to grant. The seeds' full
 * validation lives in the customer package; this reads only these fields.
 */

export interface ResidentSeedSummary {
  personaId: string;
  /** EventBridge Scheduler cron, New York time. */
  schedule: string;
  modelId: string;
}

function stringField(seed: Record<string, unknown>, field: string, file: string): string {
  const value = seed[field];
  if (typeof value !== "string" || value.length === 0) throw new Error(`Resident seed ${file} has no ${field}`);
  return value;
}

export function loadResidentSeeds(dir: string = CUSTOMER_RESIDENT_SEEDS_DIR): ResidentSeedSummary[] {
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => {
      const seed = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")) as Record<string, unknown>;
      return { personaId: stringField(seed, "persona_id", file), schedule: stringField(seed, "schedule", file), modelId: stringField(seed, "model_id", file) };
    });
}

function filesUnder(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(full) : [full];
  });
}

/** A hash of every file the sync's output depends on, so CloudFormation re-runs it exactly when one changes. */
export function residentSyncHash(inputs: string[] = CUSTOMER_RESIDENT_SYNC_INPUTS): string {
  const hash = createHash("sha256");
  for (const file of inputs.flatMap(filesUnder).sort()) {
    hash.update(path.basename(file)).update(fs.readFileSync(file));
  }
  return hash.digest("hex");
}
