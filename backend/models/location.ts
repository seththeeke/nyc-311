import { z } from "zod";

/*
 * Mirrors data-model.md's Location entity. location_id = bbl (a Location
 * only ever exists once a bbl has resolved). Descriptive fields are
 * nullable — real 311 records vary in completeness the same way Request's
 * fields do (1-data-ingestion.md §4's lenient philosophy applies here too).
 */

export const LocationSchema = z.object({
  location_id: z.string().min(1),
  bbl: z.string().min(1),
  address: z.string().min(1).nullable(),
  borough: z.string().min(1).nullable(),
  community_board: z.string().min(1).nullable(),
  zip: z.string().min(1).nullable(),
  latitude: z.string().min(1).nullable(),
  longitude: z.string().min(1).nullable(),
  created_at: z.string().min(1),
});

export type Location = z.infer<typeof LocationSchema>;
