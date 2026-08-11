import { z } from "zod";

// The NYC 311 poller's checkpoint, per 1-data-ingestion.md §2 — stored as a
// sentinel item inside the Requests table (PK = CURSOR_SENTINEL_PK below).
// Not a data-model.md domain entity, but still a shared model consumed by
// dao/service/controller, so it lives here in models/ alongside Request.
//
// last_watermark is null until the first poll window has ever fully
// drained. resume_offset is non-null only while a run is mid-window
// (capped before finishing), so the next run resumes pagination instead of
// re-starting or skipping ahead.

export const IngestionCursorSchema = z.object({
  last_watermark: z.string().min(1).nullable(),
  resume_offset: z.number().int().nonnegative().nullable(),
});

export type IngestionCursor = z.infer<typeof IngestionCursorSchema>;

// Constant string, ALL_CAPS per CLAUDE.md §6 — "NYC_311" matches the
// RequestSchema.source enum value it identifies.
export const CURSOR_SENTINEL_PK = "CURSOR#NYC_311";
