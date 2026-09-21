import { useState, type ReactElement } from "react";
import { Link } from "react-router-dom";
import { useCapacity } from "../../hooks/useCapacity";
import { AddCapacityForm } from "../capacity/AddCapacityForm";
import { CapacityRosterTable } from "../capacity/CapacityRosterTable";
import { CapacityStatsPanel } from "../capacity/CapacityStatsPanel";
import { PAGE_CONTENT_CLASSES } from "../pageLayout";

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
    <div className="relative min-h-full overflow-hidden bg-surface">
      <div aria-hidden="true" className="theme-aurora pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-aurora-1 absolute -top-32 -left-32 h-[32rem] w-[32rem] rounded-full bg-emerald-600/30 blur-3xl" />
        <div className="animate-aurora-2 absolute top-1/3 -right-24 h-[28rem] w-[28rem] rounded-full bg-cyan-600/30 blur-3xl" />
      </div>
      <div
        aria-hidden="true"
        className="bg-grid-glow pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_65%_55%_at_50%_0%,black,transparent)]"
      />

      <main className={PAGE_CONTENT_CLASSES}>
        <Link to="/admin" className="text-sm font-medium text-fg-muted transition-colors hover:text-fg">
          &larr; Admin
        </Link>
        <h1 className="mt-4 bg-gradient-to-r from-hue-emerald via-hue-cyan to-hue-violet bg-clip-text text-3xl font-black tracking-tight text-transparent sm:text-4xl">
          Capacity
        </h1>
        <p className="mt-2 text-fg-subtle">Manage the vehicle fleet — add or remove capacity.</p>

        {isLoading && <p className="mt-8 text-fg-subtle">Loading…</p>}
        {error && (
          <p role="alert" className="mt-8 text-danger">
            {error.message}
          </p>
        )}

        {status && (
          <div className="mt-8 space-y-8 glass rounded-2xl p-6">
            <CapacityStatsPanel status={status} />

            <section>
              <h2 className="text-lg font-semibold text-fg">Add capacity</h2>
              <div className="mt-3">
                <AddCapacityForm roster={status.roster} onAdd={addCapacity} isAdding={isAdding} error={addError} />
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-fg">Active fleet</h2>
              {removeError && (
                <p role="alert" className="mt-2 text-sm text-danger">
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
