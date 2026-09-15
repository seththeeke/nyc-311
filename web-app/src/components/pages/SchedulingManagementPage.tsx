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
          Scheduling
        </h1>
        <p className="mt-2 text-slate-400">
          Attempts to dispatch Orders waiting in the schedule queue against the idle vehicle fleet. Runs automatically
          every hour — use this to kick off a run on demand for testing.
        </p>

        <div className="mt-8 space-y-4 rounded-2xl border border-white/10 bg-slate-950 p-6 shadow-2xl shadow-emerald-950/20">
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
    </div>
  );
}
