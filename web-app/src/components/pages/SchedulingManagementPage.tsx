import type { ReactElement } from "react";
import { Link } from "react-router-dom";
import { useScheduling } from "../../hooks/useScheduling";

/**
 * The admin-gated Scheduling page (`10-capacity-modeling-and-integration.md`
 * §5.1) — an on-demand trigger for testing purposes, since scheduling
 * otherwise only runs on its hourly EventBridge Schedule. Deliberately no
 * output-statistics display yet — that's still being thought through.
 */
export function SchedulingManagementPage(): ReactElement {
  const { runScheduling, isRunning, error, isSuccess } = useScheduling();

  async function handleRun(): Promise<void> {
    try {
      await runScheduling();
    } catch {
      /* error (from the hook's mutation state) already surfaces the failure below. */
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <Link to="/admin" className="text-sm text-slate-400 hover:text-slate-200">
        &larr; Admin
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-slate-900">Scheduling</h1>
      <p className="mt-1 text-slate-600">
        Attempts to dispatch Orders waiting in the schedule queue against the idle vehicle fleet. Runs automatically
        every hour — use this to kick off a run on demand for testing.
      </p>

      <div className="mt-8 space-y-4 rounded-2xl bg-slate-950 p-6">
        <button
          type="button"
          onClick={() => void handleRun()}
          disabled={isRunning}
          className="rounded bg-emerald-600 px-4 py-2 text-white disabled:opacity-50"
        >
          {isRunning ? "Running…" : "Run scheduling now"}
        </button>

        {isSuccess && !isRunning && (
          <p role="status" className="text-sm text-emerald-400">
            Scheduling run complete.
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error.message}
          </p>
        )}
      </div>
    </main>
  );
}
