import type { ReactElement } from "react";
import { useAuth } from "../../hooks/useAuth";

/**
 * Placeholder landing page behind `AdminRoute`
 * (`9-admin-auth-integration.md` §3) — proves the guard protects something
 * real end-to-end. `10-capacity-modeling-and-integration.md` §2.2 replaces
 * this with the real tile-grid Admin page (Capacity as its first tile).
 */
export function AdminPage(): ReactElement {
  const { user, signOut } = useAuth();

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-2xl font-semibold text-slate-900">Admin</h1>
      {user && <p className="mt-2 text-slate-600">Signed in as {user.email}</p>}
      <button
        type="button"
        onClick={() => void signOut()}
        className="mt-6 rounded bg-slate-200 px-4 py-2 text-slate-900"
      >
        Sign out
      </button>
    </main>
  );
}
