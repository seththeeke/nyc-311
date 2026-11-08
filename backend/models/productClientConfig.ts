import { z } from "zod";
import { OpsClientConfigSchema } from "./opsClientConfig";

/** The most warehouse queries one CPO run may send (docs/17-executive-team.md §17.11). */
export const PRODUCT_QUERY_LIMIT_MAX = 10;

/*
 * What the boroughsim-product MCP server reads from its environment
 * (docs/17-executive-team.md §17.2): the ops client's sign-in, plus the
 * run's query budget, lower in Celestine's CONVERSE runs (§21.4). It can't
 * be raised past the cap.
 */
export const ProductClientConfigSchema = OpsClientConfigSchema.extend({
  PRODUCT_QUERY_LIMIT: z.coerce.number().int().min(0).max(PRODUCT_QUERY_LIMIT_MAX).optional(),
});
export type ProductClientConfig = z.infer<typeof ProductClientConfigSchema>;
