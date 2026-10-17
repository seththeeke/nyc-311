import * as path from "node:path";

/*
 * The one sanctioned place that names the customer's code package
 * (CLAUDE.md §5.3, `local/customer-boundary`). Every customer Lambda's
 * entry point is built from this; no other file under cdk/customer/ may
 * contain a `backend` path segment, so none can point at BoroughSim's.
 */
export const CUSTOMER_BACKEND_ROOT = path.join(__dirname, "..", "..", "customer", "backend");

/* The resident seed files (13-customer-simulation.md §2 customer side, decision 2), read at synth for their schedules and models. */
export const CUSTOMER_RESIDENT_SEEDS_DIR = path.join(CUSTOMER_BACKEND_ROOT, "residents");

/* What the seed sync writes depends on these; a change to any re-runs the sync on the next deploy. */
export const CUSTOMER_RESIDENT_SYNC_INPUTS = [
  CUSTOMER_RESIDENT_SEEDS_DIR,
  path.join(CUSTOMER_BACKEND_ROOT, "service", "resident"),
  path.join(CUSTOMER_BACKEND_ROOT, "models"),
];
