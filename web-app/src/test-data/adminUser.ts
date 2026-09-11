import type { User } from "../models/user";

/*
 * Baked mock admin credential/User for "mock" data mode
 * (9-admin-auth-integration.md §6) — LoginPage still renders and exercises
 * the real login form; MockAuthService validates against this fixed
 * credential instead of calling Cognito.
 */
export const MOCK_ADMIN_CREDENTIAL = {
  email: "admin@example.com",
  password: "mock-password",
};

export const MOCK_ADMIN_USER: User = {
  user_id: "01MOCKADMIN0000000000001",
  type: "ADMIN",
  status: "ACTIVE",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  last_active_at: "2026-01-01T00:00:00.000Z",
  cognito_sub: "mock-sub",
  email: MOCK_ADMIN_CREDENTIAL.email,
  display_name: "Mock Admin",
};
