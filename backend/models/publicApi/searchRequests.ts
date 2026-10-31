import { z } from "zod";
import { UlidSchema } from "./publicApiPrimitives";
import { ServiceRequestSchema } from "./serviceRequest";

/* `POST /v1/requests/search` (16-resident-action-models.md §2.4.1). search_params grows additively. */

export const SEARCH_REQUESTS_DEFAULT_LIMIT = 20;
export const SEARCH_REQUESTS_MAX_LIMIT = 50;

export const SearchRequestsParamsSchema = z
  .object({
    order_id: UlidSchema,
  })
  .strict();

export const SearchRequestsBodySchema = z
  .object({
    search_params: SearchRequestsParamsSchema,
    limit: z.number().int().min(1).max(SEARCH_REQUESTS_MAX_LIMIT).default(SEARCH_REQUESTS_DEFAULT_LIMIT),
    cursor: z.string().min(1).nullable().optional(),
  })
  .strict();
export type SearchRequestsBody = z.infer<typeof SearchRequestsBodySchema>;

export const SearchRequestsResponseSchema = z.object({
  items: z.array(ServiceRequestSchema),
  next_cursor: z.string().min(1).nullable(),
});
export type SearchRequestsResponse = z.infer<typeof SearchRequestsResponseSchema>;
