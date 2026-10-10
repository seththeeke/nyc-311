import { config } from "../config";
import { UserSchema, type User } from "../models/user";
import { MOCK_ADMIN_CREDENTIAL, MOCK_ADMIN_USER } from "../test-data/adminUser";

/**
 * `signIn`'s outcome — `NEW_PASSWORD_REQUIRED` when Cognito's
 * `AdminCreateUser` left the account with a temporary password (the real
 * admin's provisioning path, `9-admin-auth-integration.md` §1). Callers
 * (LoginPage) must then collect a new password and call
 * `completeNewPassword` before a session exists.
 */
export type SignInResult = { status: "SIGNED_IN"; user: User } | { status: "NEW_PASSWORD_REQUIRED" };

/*
 * One interface, two implementations, selected by VITE_DATA_MODE at build time
 * (CLAUDE.md §5.1, `9-admin-auth-integration.md` §3) — same shape as every
 * other service in this codebase.
 */
export interface AuthService {
  signIn(email: string, password: string): Promise<SignInResult>;
  /** Completes a NEW_PASSWORD_REQUIRED challenge from `signIn`. Never called otherwise. */
  completeNewPassword(newPassword: string): Promise<User>;
  signOut(): Promise<void>;
  getCurrentUser(): Promise<User | null>;
}

type AmplifyAuthModule = typeof import("aws-amplify/auth");

let amplifyAuthModulePromise: Promise<AmplifyAuthModule> | null = null;

/**
 * Cognito's SRP/crypto client (`aws-amplify` + `aws-amplify/auth`) is
 * ~250 KB pre-minified — dynamic-imported here instead of a static
 * top-level import so it lands in its own chunk rather than the main
 * bundle every page pays for just to render the sidebar's logged-in/out
 * state (`useAuth` runs on every page). Same split pattern as
 * `AppRoutes.tsx`'s lazy-loaded pages; cached so only the first call per
 * page load pays the import cost.
 */
async function loadAmplifyAuth(): Promise<AmplifyAuthModule> {
  if (!amplifyAuthModulePromise) {
    amplifyAuthModulePromise = Promise.all([import("aws-amplify"), import("aws-amplify/auth")]).then(
      ([{ Amplify }, auth]) => {
        Amplify.configure({
          Auth: {
            Cognito: {
              userPoolId: config.userPoolId,
              userPoolClientId: config.userPoolClientId,
            },
          },
        });
        return auth;
      }
    );
  }
  return amplifyAuthModulePromise;
}

/*
 * Real, Cognito-backed implementation (custom login form, not Hosted UI —
 * §3). getCurrentUser resolves the current session's ID token (its `aud`
 * claim matches the app client — what the API's JWT authorizer checks,
 * unlike the access token) and calls GET /admin/whoami to get the real
 * User record, not just the raw Cognito claims.
 */
class LiveAuthService implements AuthService {
  async signIn(email: string, password: string): Promise<SignInResult> {
    const { signIn: amplifySignIn } = await loadAmplifyAuth();
    const result = await amplifySignIn({ username: email, password });
    return this.resolveSignInStep(result);
  }

  async completeNewPassword(newPassword: string): Promise<User> {
    const { confirmSignIn: amplifyConfirmSignIn } = await loadAmplifyAuth();
    const result = await amplifyConfirmSignIn({ challengeResponse: newPassword });
    const outcome = await this.resolveSignInStep(result);
    if (outcome.status !== "SIGNED_IN") {
      throw new Error(`Unsupported sign-in challenge after new password: ${outcome.status}`);
    }
    return outcome.user;
  }

  private async resolveSignInStep(result: { isSignedIn: boolean; nextStep: { signInStep: string } }): Promise<SignInResult> {
    if (result.isSignedIn) {
      const user = await this.getCurrentUser();
      if (!user) {
        throw new Error("Signed in but failed to resolve the current user");
      }
      return { status: "SIGNED_IN", user };
    }
    if (result.nextStep.signInStep === "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED") {
      return { status: "NEW_PASSWORD_REQUIRED" };
    }
    throw new Error(`Unsupported sign-in challenge: ${result.nextStep.signInStep}`);
  }

  async signOut(): Promise<void> {
    const { signOut: amplifySignOut } = await loadAmplifyAuth();
    await amplifySignOut();
  }

  async getCurrentUser(): Promise<User | null> {
    let idToken: string | undefined;
    try {
      const { fetchAuthSession } = await loadAmplifyAuth();
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

  async signIn(email: string, password: string): Promise<SignInResult> {
    if (email !== MOCK_ADMIN_CREDENTIAL.email || password !== MOCK_ADMIN_CREDENTIAL.password) {
      throw new Error("Invalid email or password");
    }
    this.loggedIn = true;
    return { status: "SIGNED_IN", user: MOCK_ADMIN_USER };
  }

  /** The mock credential is always permanent — this challenge never arises in mock mode. */
  async completeNewPassword(): Promise<User> {
    throw new Error("completeNewPassword is not applicable in mock mode");
  }

  async signOut(): Promise<void> {
    this.loggedIn = false;
  }

  async getCurrentUser(): Promise<User | null> {
    return this.loggedIn ? MOCK_ADMIN_USER : null;
  }
}

export const authService: AuthService = import.meta.env.VITE_DATA_MODE === "live" ? new LiveAuthService() : new MockAuthService();
