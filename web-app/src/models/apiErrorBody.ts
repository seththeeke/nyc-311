import { z } from "zod";

/*
 * The JSON body the backend's jsonResponse sends with a non-2xx status,
 * e.g. a 409's "reload and retry". Only `message` is read; anything else
 * passes through untouched. Parsed in services/http.ts so no service
 * casts an error body unchecked (CLAUDE.md §5.1).
 */
export const ApiErrorBodySchema = z.object({
  message: z.string(),
});
export type ApiErrorBody = z.infer<typeof ApiErrorBodySchema>;
