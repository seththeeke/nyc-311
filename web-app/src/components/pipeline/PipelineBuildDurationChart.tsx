import type { ReactElement } from "react";
import type { PipelineExecution } from "../../models/pipelineStatus";
import { niceMax } from "../ingestion/formatters";
import { IV_COLORS } from "../ingestion/palette";
import { formatDurationSeconds, formatRelativeTime } from "./formatters";

export interface PipelineBuildDurationChartProps {
  executions: PipelineExecution[];
}

const CHART_HEIGHT_PX = 120;

/** Just the commit's subject line — same truncation PipelineExecutionHistory uses for its row label. */
function firstLine(message: string): string {
  const newlineIndex = message.indexOf("\n");
  return newlineIndex === -1 ? message : message.slice(0, newlineIndex);
}

/*
 * Bar chart of the Build stage's own duration across recent pipeline runs
 * — added 2026-08-28 alongside the MEDIUM -> LARGE CodeBuild compute-type
 * change (pipeline/Nyc311PipelineStack.ts) specifically so that change's
 * effect is visible here, not just asserted in a commit message. Same
 * hand-rolled bar-chart shape as LambdaHealthChart (this app has no
 * charting library dependency) — single series here, since a build either
 * ran or hasn't finished yet, not a part-to-whole breakdown.
 */
export function PipelineBuildDurationChart({ executions }: PipelineBuildDurationChartProps): ReactElement {
  /* Oldest first — a trend reads left-to-right; the API returns newest-first. */
  const completed = executions
    .filter((execution): execution is PipelineExecution & { buildDurationSeconds: number; startTime: string } =>
      execution.buildDurationSeconds !== null && execution.startTime !== null
    )
    .slice()
    .reverse();

  const axisMax = niceMax(Math.max(...completed.map((e) => e.buildDurationSeconds), 1));

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      {/* The page's own "Build duration" Section heading already labels this — no need to repeat it here. */}
      {completed.length === 0 ? (
        <p className="text-sm text-slate-400">No completed builds in the current history yet.</p>
      ) : (
        <>
          <p className="text-xs text-slate-500">Last {completed.length} completed builds</p>
          <div className="mt-3 pt-14">
            <div className="flex items-end gap-2" style={{ height: CHART_HEIGHT_PX }}>
              {completed.map((execution) => (
                <div
                  key={execution.executionId}
                  className="group relative flex h-full flex-1 flex-col-reverse items-stretch"
                >
                  <div
                    className="w-full rounded-t-sm"
                    style={{
                      height: `${(execution.buildDurationSeconds / axisMax) * 100}%`,
                      backgroundColor: IV_COLORS.seriesIngested,
                    }}
                  />
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 w-max max-w-48 -translate-x-1/2 rounded-md bg-slate-900 px-2.5 py-1.5 text-[10px] text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                  >
                    <span className="block font-medium">{formatDurationSeconds(execution.buildDurationSeconds)}</span>
                    <span className="block text-slate-300">{formatRelativeTime(execution.startTime)}</span>
                    <span className="block text-slate-300">
                      {execution.commitMessage ? firstLine(execution.commitMessage) : "Pipeline restart (no commit)"}
                    </span>
                  </span>
                  <button
                    type="button"
                    aria-label={`${formatRelativeTime(execution.startTime)}: build took ${formatDurationSeconds(execution.buildDurationSeconds)}`}
                    className="absolute inset-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                  />
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
