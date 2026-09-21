import type { UseAuthResult } from "../../src/hooks/useAuth";
import type { User } from "../../src/models/user";

export const ADMIN_USER: User = {
  user_id: "01ADMIN",
  type: "ADMIN",
  status: "ACTIVE",
  created_at: "2026-09-10T00:00:00.000Z",
  updated_at: "2026-09-10T00:00:00.000Z",
  last_active_at: "2026-09-10T00:00:00.000Z",
  cognito_sub: "abc-123",
  email: "admin@example.com",
  display_name: null,
};

/** A full useAuth result for a signed-out visitor, overridable per test. */
export function authResult(overrides: Partial<UseAuthResult> = {}): UseAuthResult {
  return {
    user: null,
    isLoading: false,
    signIn: async () => "SIGNED_IN" as const,
    signInError: null,
    isSigningIn: false,
    completeNewPassword: async () => undefined,
    completeNewPasswordError: null,
    isCompletingNewPassword: false,
    signOut: async () => undefined,
    ...overrides,
  };
}
