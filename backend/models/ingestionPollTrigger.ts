import { z } from "zod";

/*
 * The EventBridge Scheduler target's configured Input for the NYC 311
 * poller — empty/near-empty by design, since every run derives its own
 * window from the stored cursor (1-data-ingestion.md §2) rather than
 * taking per-invocation parameters. Still validated, not just cast, per
 * CLAUDE.md §5.2's "every controller validates its incoming payload" rule
 * — even a trigger with nothing meaningful to say should fail loudly if
 * it's not even a JSON object.
 */

export const IngestionPollTriggerSchema = z.record(z.string(), z.unknown());

export type IngestionPollTrigger = z.infer<typeof IngestionPollTriggerSchema>;
