import type { ReactElement } from "react";
import { Link } from "react-router-dom";
import { useScheduling } from "../../hooks/useScheduling";
import { PAGE_CONTENT_CLASSES } from "../pageLayout";

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
          Scheduling
        </h1>
        <p className="mt-2 text-fg-subtle">
          Attempts to dispatch Orders waiting in the schedule queue against the idle vehicle fleet. Runs automatically
          every hour — use this to kick off a run on demand for testing.
        </p>

        <div className="mt-8 space-y-4 glass rounded-2xl p-6">
          <button
            type="button"
            onClick={() => void handleRun()}
            disabled={isRunning}
            className="rounded bg-emerald-600 px-4 py-2 text-on-accent disabled:opacity-50"
          >
            {isRunning ? "Running…" : "Run scheduling now"}
          </button>

          {isSuccess && !isRunning && (
            <p role="status" className="text-sm text-hue-emerald">
              Scheduling run complete.
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error.message}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
