import { useState } from "react";
import { useAuth } from "../state/auth";
import { Tabs } from "../components/Tabs";
import { IncidentMap } from "../components/IncidentMap";
import { CaseQueueBoard } from "../components/CaseQueueBoard";
import { CapacityView } from "../components/CapacityView";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "cases", label: "Case Queues" },
  { key: "capacity", label: "Capacity" },
];

function LoginGate() {
  const { login } = useAuth();
  const [pending, setPending] = useState(false);

  return (
    <div className="mx-auto mt-16 max-w-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-brand-500)] text-lg font-bold text-white">C</div>
      <h1 className="mt-3 text-lg font-semibold text-[var(--color-ink)]">Login</h1>
      <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
        Demo login &mdash; no real credentials. One click signs you in as the sandbox admin account.
      </p>
      <button
        onClick={async () => {
          setPending(true);
          await login();
          setPending(false);
        }}
        disabled={pending}
        className="mt-4 w-full rounded-md bg-[var(--color-brand-500)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-brand-600)] disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Log in as Admin"}
      </button>
    </div>
  );
}

function AdminConsole() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState("overview");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-ink)]">Admin Console</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
            Signed in as <strong className="text-[var(--color-ink)]">{user?.display_name}</strong> ({user?.email}).
            Actions here mutate the mock backend for this session only.
          </p>
        </div>
        <button onClick={logout} className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--color-paper)]">
          Log out
        </button>
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === "overview" && <IncidentMap height={480} />}
      {tab === "cases" && <CaseQueueBoard interactive={true} />}
      {tab === "capacity" && <CapacityView />}
    </div>
  );
}

export function LoginPage() {
  const { isAdmin } = useAuth();
  return (
    <div className="mx-auto min-h-[100svh] w-full max-w-5xl px-4 pb-16 pt-24">
      {isAdmin ? <AdminConsole /> : <LoginGate />}
    </div>
  );
}
