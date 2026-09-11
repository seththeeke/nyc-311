import { z } from "zod";

/*
 * Mirrors data-model.md#user. Plain record, not event-sourced. `type` has
 * a single value today (no public_actor tier — data-model.md's "Deferred"
 * section) but stays an enum, not a literal, so a future tier doesn't need
 * a schema migration. Enum values ALL_CAPS per CLAUDE.md §6.
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
