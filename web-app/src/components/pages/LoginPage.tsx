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
 */
export function LoginPage(): ReactElement {
  const { user, signIn, isSigningIn, signInError } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  if (user) {
    const state = location.state as LocationState | null;
    return <Navigate to={state?.from?.pathname ?? "/admin"} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    try {
      await signIn(email, password);
    } catch {
      /* signInError (from useAuth's mutation state) already surfaces the failure below. */
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold text-slate-900">Admin sign in</h1>
      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
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
