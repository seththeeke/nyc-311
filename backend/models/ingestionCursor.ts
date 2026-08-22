import { z } from "zod";

/*
 * The NYC 311 poller's checkpoint (1-data-ingestion.md §2), stored as a
 * sentinel item in the Requests table. last_watermark is null until a poll
 * window fully drains; resume_offset is non-null only mid-window, so the
 * next run resumes instead of restarting.
 */

export const IngestionCursorSchema = z.object({
  last_watermark: z.string().min(1).nullable(),
  resume_offset: z.number().int().nonnegative().nullable(),
});

export type IngestionCursor = z.infer<typeof IngestionCursorSchema>;

/*
 * Constant string, ALL_CAPS per CLAUDE.md §6 — "NYC_311" matches the
 * RequestSchema.source enum value it identifies.
 */
export const CURSOR_SENTINEL_PK = "CURSOR#NYC_311";

/*
 * IngestionCursor plus a computed staleness signal — the service's own
 * return value (backs the cursor section of GET /ingestion/metrics), not
 * read from an external boundary, so unlike IngestionCursor it has no
 * paired zod schema (same reasoning as models/pollResult.ts).
 * `lag_hours`/`is_stale` are null/false whenever `last_watermark` is null.
 */
export interface IngestionCursorStatus {
  last_watermark: string | null;
  resume_offset: number | null;
  lag_hours: number | null;
  is_stale: boolean;
}
