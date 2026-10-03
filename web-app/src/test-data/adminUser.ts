import type { User } from "../models/user";

/*
 * Baked mock admin credential/User for "mock" data mode
 * (9-admin-auth-integration.md §6) — LoginPage still renders and exercises
 * the real login form; MockAuthService validates against this fixed
 * credential instead of calling Cognito.
 */
const MOCK_ADMIN_EMAIL = "admin@example.com";

/*
 * No module-level property reads (e.g. `MOCK_ADMIN_CREDENTIAL.email`
 * below) — the bundler keeps those as possible getter side effects, which
 * leaked this credential into live builds (v1-prod-deployment.md A15).
 */
export const MOCK_ADMIN_CREDENTIAL = {
  email: MOCK_ADMIN_EMAIL,
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
  email: MOCK_ADMIN_EMAIL,
  display_name: "Mock Admin",
};
