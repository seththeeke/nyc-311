import type { ReactElement } from "react";
import { Link } from "react-router-dom";
import { useLambdaMetrics } from "../../hooks/useLambdaMetrics";
import { LambdaHealthChart } from "../monitoring/LambdaHealthChart";

/**
 * Added after the 2026-08-22 fan-out-Lambda incident: a Lambda erroring on
 * every single invocation went unnoticed for days, with nothing in the
 * UI ever surfacing it. One chart per monitored Lambda, invocation/
 * success/error counts over the last 7 days.
 */
export function LambdaMonitoringPage(): ReactElement {
  const { data, isPending, isError, error } = useLambdaMetrics();

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-aurora-1 absolute -top-40 -right-16 h-[26rem] w-[26rem] rounded-full bg-amber-500/25 blur-3xl" />
        <div className="animate-aurora-3 absolute -bottom-32 -left-24 h-[22rem] w-[22rem] rounded-full bg-orange-600/15 blur-3xl" />
      </div>
      <div
        aria-hidden="true"
        className="bg-grid-glow pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_65%_45%_at_50%_0%,black,transparent)]"
      />

      <main className="relative mx-auto max-w-5xl px-6 py-16">
        <Link to="/monitoring" className="text-sm font-medium text-slate-300 transition-colors hover:text-white">
          &larr; Monitoring
        </Link>
        <h1 className="mt-4 bg-gradient-to-r from-amber-300 via-orange-300 to-red-300 bg-clip-text text-3xl font-black tracking-tight text-transparent sm:text-4xl">
          Lambda Health
        </h1>
        <p className="mt-2 text-slate-400">Invocations, successes, and errors per Lambda over the last 7 days.</p>

        {isPending && <p className="mt-6 text-slate-400">Loading…</p>}

        {isError && (
          <p role="alert" className="mt-6 text-red-400">
            Failed to load Lambda metrics{error instanceof Error ? `: ${error.message}` : "."}
          </p>
        )}

        {!isPending && !isError && data.length === 0 && (
          <p className="mt-6 text-slate-400">No monitored Lambdas configured.</p>
        )}

        {!isPending && !isError && data.length > 0 && (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {data.map((lambda) => (
              <LambdaHealthChart key={lambda.functionName} lambda={lambda} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
