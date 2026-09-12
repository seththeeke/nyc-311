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
    <main className="mx-auto max-w-4xl px-6 py-16">
      <Link to="/admin" className="text-sm text-slate-400 hover:text-slate-200">
        &larr; Admin
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-slate-900">Capacity</h1>
      <p className="mt-1 text-slate-600">Manage the vehicle fleet — add or remove capacity.</p>

      {isLoading && <p className="mt-8 text-slate-500">Loading…</p>}
      {error && (
        <p role="alert" className="mt-8 text-red-600">
          {error.message}
        </p>
      )}

      {status && (
        <div className="mt-8 space-y-8 rounded-2xl bg-slate-950 p-6">
          <CapacityStatsPanel status={status} />

          <section>
            <h2 className="text-lg font-semibold text-white">Add capacity</h2>
            <div className="mt-3">
              <AddCapacityForm onAdd={addCapacity} isAdding={isAdding} error={addError} />
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
  );
}
