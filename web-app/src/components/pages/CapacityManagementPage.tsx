import { useState, type ReactElement } from "react";
import { Link } from "react-router-dom";
import { useCapacity } from "../../hooks/useCapacity";
import { AddCapacityForm } from "../capacity/AddCapacityForm";
import { CapacityRosterTable } from "../capacity/CapacityRosterTable";
import { CapacityStatsPanel } from "../capacity/CapacityStatsPanel";

/**
 * The admin-gated Capacity page (`10-capacity-modeling-and-integration.md`
 * §2.2) — live fleet stats, the active roster, add/remove controls. Not
 * yet wired into scheduling (Leg 1.5) — this is purely CRUD + views.
 */
export function CapacityManagementPage(): ReactElement {
  const { status, isLoading, error, addCapacity, isAdding, addError, removeCapacity, isRemoving, removeError } =
    useCapacity();
  const [removingOperatorId, setRemovingOperatorId] = useState<string | null>(null);

  async function handleRemove(operatorId: string): Promise<void> {
    setRemovingOperatorId(operatorId);
    try {
      await removeCapacity(operatorId);
    } catch {
      /* removeError already surfaces the failure below. */
    } finally {
      setRemovingOperatorId(null);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-aurora-1 absolute -top-32 -left-32 h-[32rem] w-[32rem] rounded-full bg-emerald-600/30 blur-3xl" />
        <div className="animate-aurora-2 absolute top-1/3 -right-24 h-[28rem] w-[28rem] rounded-full bg-cyan-600/30 blur-3xl" />
      </div>
      <div
        aria-hidden="true"
        className="bg-grid-glow pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_65%_55%_at_50%_0%,black,transparent)]"
      />

      <main className="relative mx-auto max-w-4xl px-6 py-16">
        <Link to="/admin" className="text-sm font-medium text-slate-300 transition-colors hover:text-white">
          &larr; Admin
        </Link>
        <h1 className="mt-4 bg-gradient-to-r from-emerald-300 via-cyan-300 to-violet-300 bg-clip-text text-3xl font-black tracking-tight text-transparent sm:text-4xl">
          Capacity
        </h1>
        <p className="mt-2 text-slate-400">Manage the vehicle fleet — add or remove capacity.</p>

        {isLoading && <p className="mt-8 text-slate-400">Loading…</p>}
        {error && (
          <p role="alert" className="mt-8 text-red-400">
            {error.message}
          </p>
        )}

        {status && (
          <div className="mt-8 space-y-8 rounded-2xl border border-white/10 bg-slate-950 p-6 shadow-2xl shadow-emerald-950/20">
            <CapacityStatsPanel status={status} />

            <section>
              <h2 className="text-lg font-semibold text-white">Add capacity</h2>
              <div className="mt-3">
                <AddCapacityForm roster={status.roster} onAdd={addCapacity} isAdding={isAdding} error={addError} />
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white">Active fleet</h2>
              {removeError && (
                <p role="alert" className="mt-2 text-sm text-red-400">
                  {removeError.message}
                </p>
              )}
              <div className="mt-3">
                <CapacityRosterTable
                  roster={status.roster}
                  onRemove={(operatorId) => void handleRemove(operatorId)}
                  removingOperatorId={isRemoving ? removingOperatorId : null}
                />
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
