import { z } from "zod";

/*
 * POST /admin/warehouse/query's request body (7-data-warehousing.md
 * §12a, Leg 7) — a single ad-hoc SQL string, admin-only. The controller's
 * read-only statement-prefix check runs on `sql` after this shape is
 * confirmed; that check isn't encoded in the zod schema since it's a
 * business rule, not a structural one.
 */
export const AdHocQueryRequestSchema = z.object({
  sql: z.string().min(1),
});
export type AdHocQueryRequest = z.infer<typeof AdHocQueryRequestSchema>;
