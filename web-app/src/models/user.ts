import { z } from "zod";

/*
 * Mirrors backend/models/user.ts's User — the shape GET /admin/whoami
 * returns. Every service response is parsed through this schema before it
 * reaches a component (CLAUDE.md §5.1's runtime-validation-at-the-network-
 * boundary rule).
 */

export const USER_TYPES = ["ADMIN"] as const;
export type UserType = (typeof USER_TYPES)[number];

export const USER_STATUSES = ["ACTIVE", "DISABLED"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const UserSchema = z.object({
  user_id: z.string().min(1),
  type: z.enum(USER_TYPES),
  status: z.enum(USER_STATUSES),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
  last_active_at: z.string().min(1),
  cognito_sub: z.string().min(1),
  email: z.string().min(1),
  display_name: z.string().min(1).nullable(),
});
export type User = z.infer<typeof UserSchema>;
