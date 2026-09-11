import { Amplify } from "aws-amplify";
import { fetchAuthSession, signIn as amplifySignIn, signOut as amplifySignOut } from "aws-amplify/auth";
import { config } from "../config";
import { UserSchema, type User } from "../models/user";
import { MOCK_ADMIN_CREDENTIAL, MOCK_ADMIN_USER } from "../test-data/adminUser";

/*
 * One interface, two implementations, selected by config.dataMode
 * (CLAUDE.md §5.1, `9-admin-auth-integration.md` §3) — same shape as every
 * other service in this codebase.
 */
export interface AuthService {
  signIn(email: string, password: string): Promise<User>;
  signOut(): Promise<void>;
  getCurrentUser(): Promise<User | null>;
}

let amplifyConfigured = false;

function ensureAmplifyConfigured(): void {
  if (amplifyConfigured) return;
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: config.userPoolId,
        userPoolClientId: config.userPoolClientId,
      },
    },
  });
  amplifyConfigured = true;
}

/*
 * Real, Cognito-backed implementation (custom login form, not Hosted UI —
 * §3). getCurrentUser resolves the current session's ID token (its `aud`
 * claim matches the app client — what the API's JWT authorizer checks,
 * unlike the access token) and calls GET /admin/whoami to get the real
 * User record, not just the raw Cognito claims.
 */
class LiveAuthService implements AuthService {
  async signIn(email: string, password: string): Promise<User> {
    ensureAmplifyConfigured();
    await amplifySignIn({ username: email, password });
    const user = await this.getCurrentUser();
    if (!user) {
      throw new Error("Signed in but failed to resolve the current user");
    }
    return user;
  }

  async signOut(): Promise<void> {
    ensureAmplifyConfigured();
    await amplifySignOut();
  }

  async getCurrentUser(): Promise<User | null> {
    ensureAmplifyConfigured();
    let idToken: string | undefined;
    try {
      const session = await fetchAuthSession();
      idToken = session.tokens?.idToken?.toString();
    } catch {
      return null;
    }
    if (!idToken) return null;

    const response = await fetch(`${config.apiBaseUrl}/admin/whoami`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    return UserSchema.parse(body);
  }
}

/*
 * Mock implementation (§6) — the real LoginPage still renders and is
 * exercised in mock mode, but this validates against a fixed in-memory
 * credential instead of calling Cognito. `loggedIn` is instance state, not
 * persisted — a page reload in mock mode starts logged out again, same as
 * every other mock service having no real backing store across reloads.
 */
class MockAuthService implements AuthService {
  private loggedIn = false;

  async signIn(email: string, password: string): Promise<User> {
    if (email !== MOCK_ADMIN_CREDENTIAL.email || password !== MOCK_ADMIN_CREDENTIAL.password) {
      throw new Error("Invalid email or password");
    }
    this.loggedIn = true;
    return MOCK_ADMIN_USER;
  }

  async signOut(): Promise<void> {
    this.loggedIn = false;
  }

  async getCurrentUser(): Promise<User | null> {
    return this.loggedIn ? MOCK_ADMIN_USER : null;
  }
}

export const authService: AuthService = config.dataMode === "live" ? new LiveAuthService() : new MockAuthService();
