import { useState, type FormEvent, type ReactElement } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

interface LocationState {
  from?: { pathname: string };
}

/**
 * Custom login form (`9-admin-auth-integration.md` §3) — not Cognito's
 * Hosted UI, so the admin never leaves this site's domain. Renders in both
 * mock and live data modes (§6) — `useAuth`/`authService` decide which
 * backend actually validates the credential.
 *
 * Handles Cognito's NEW_PASSWORD_REQUIRED challenge — the state
 * `AdminCreateUser` leaves a freshly provisioned real-admin account in
 * (`9-admin-auth-integration.md` §1) — by switching to a second form
 * instead of erroring out.
 */
export function LoginPage(): ReactElement {
  const { user, signIn, isSigningIn, signInError, completeNewPassword, isCompletingNewPassword, completeNewPasswordError } =
    useAuth();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMismatch, setPasswordMismatch] = useState(false);
  const [stage, setStage] = useState<"credentials" | "newPassword">("credentials");

  if (user) {
    const state = location.state as LocationState | null;
    return <Navigate to={state?.from?.pathname ?? "/admin"} replace />;
  }

  async function handleCredentialsSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    try {
      const outcome = await signIn(email, password);
      if (outcome === "NEW_PASSWORD_REQUIRED") {
        setStage("newPassword");
      }
    } catch {
      /* signInError (from useAuth's mutation state) already surfaces the failure below. */
    }
  }

  async function handleNewPasswordSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordMismatch(true);
      return;
    }
    setPasswordMismatch(false);
    try {
      await completeNewPassword(newPassword);
    } catch {
      /* completeNewPasswordError already surfaces the failure below. */
    }
  }

  if (stage === "newPassword") {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
        <h1 className="text-2xl font-semibold text-slate-900">Set a new password</h1>
        <p className="mt-2 text-sm text-slate-600">This account needs a new password before you can sign in.</p>
        <form onSubmit={handleNewPasswordSubmit} className="mt-6 flex flex-col gap-4">
          <div>
            <label htmlFor="new-password" className="block text-sm font-medium text-slate-700">
              New password
            </label>
            <input
              id="new-password"
              name="new-password"
              type="password"
              required
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="confirm-password" className="block text-sm font-medium text-slate-700">
              Confirm new password
            </label>
            <input
              id="confirm-password"
              name="confirm-password"
              type="password"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            />
          </div>
          {passwordMismatch && (
            <p role="alert" className="text-sm text-red-600">
              Passwords don&apos;t match.
            </p>
          )}
          {completeNewPasswordError && (
            <p role="alert" className="text-sm text-red-600">
              {completeNewPasswordError.message}
            </p>
          )}
          <button
            type="submit"
            disabled={isCompletingNewPassword}
            className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
          >
            {isCompletingNewPassword ? "Setting password…" : "Set password"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold text-slate-900">Admin sign in</h1>
      <form onSubmit={handleCredentialsSubmit} className="mt-6 flex flex-col gap-4">
        <div>
          <label htmlFor="login-email" className="block text-sm font-medium text-slate-700">
            Email
          </label>
          <input
            id="login-email"
            name="email"
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="login-password" className="block text-sm font-medium text-slate-700">
            Password
          </label>
          <input
            id="login-password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
        </div>
        {signInError && (
          <p role="alert" className="text-sm text-red-600">
            {signInError.message}
          </p>
        )}
        <button
          type="submit"
          disabled={isSigningIn}
          className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
        >
          {isSigningIn ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
