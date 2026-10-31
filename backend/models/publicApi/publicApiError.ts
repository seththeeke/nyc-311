import { z } from "zod";

/* The fixed set of public error codes (16-resident-action-models.md §2.2). Adding one is an additive change. */
export const PUBLIC_API_ERROR_CODES = ["VALIDATION_ERROR", "INVALID_REQUESTER", "NOT_FOUND", "INTERNAL_ERROR"] as const;
export type PublicApiErrorCode = (typeof PUBLIC_API_ERROR_CODES)[number];

export const PublicApiErrorDetailSchema = z.object({
  field: z.string().min(1),
  issue: z.string().min(1),
});
export type PublicApiErrorDetail = z.infer<typeof PublicApiErrorDetailSchema>;

export const PublicApiErrorSchema = z.object({
  error: z.object({
    code: z.enum(PUBLIC_API_ERROR_CODES),
    message: z.string().min(1),
    details: z.array(PublicApiErrorDetailSchema).optional(),
  }),
});
export type PublicApiError = z.infer<typeof PublicApiErrorSchema>;
