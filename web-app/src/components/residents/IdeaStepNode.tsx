import type { ReactElement } from "react";
import type { IdeaStep } from "../../models/residentIdea";
import { durationLabel, toolLabel } from "./residentFormat";

/* The exact exchange with BoroughSim, for anyone who wants to see it. */
function Exchange({ execution }: { execution: NonNullable<IdeaStep["execution"]> }): ReactElement | null {
  if (!execution.request) return null;
  return (
    <details className="mt-2 text-xs">
      <summary className="cursor-pointer text-fg-subtle hover:text-fg">Request / Response</summary>
      <div className="mt-2 space-y-2 font-mono">
        <p className="text-fg-muted">
          {execution.request.method} {execution.request.path}
        </p>
        {execution.request.body !== undefined && (
          <pre className="overflow-x-auto rounded-lg bg-panel-sunken p-3 text-fg-muted">{JSON.stringify(execution.request.body, null, 2)}</pre>
        )}
        {execution.response && (
          <>
            <p className="text-fg-subtle">
              HTTP {execution.response.status_code}
              {execution.response.call_id && ` · X-Call-Id ${execution.response.call_id}`}
            </p>
            <pre className="overflow-x-auto rounded-lg bg-panel-sunken p-3 text-fg-muted">{JSON.stringify(execution.response.body, null, 2)}</pre>
          </>
        )}
      </div>
    </details>
  );
}

/** One turn of the resident's workstream: what they chose, in their words, and what it did (docs/16 §6.1). */
export function IdeaStepNode({ step }: { step: IdeaStep }): ReactElement {
  const execution = step.execution;
  const title = step.kind === "FORCED_FINISH" ? "Stopped at the limit" : step.kind === "FINISH" ? "Finished" : toolLabel(step.decision?.tool ?? "");
  return (
    <li className="relative border-l border-line pb-4 pl-5 last:pb-0">
      <span aria-hidden="true" className="absolute top-1.5 -left-[5px] h-2.5 w-2.5 rounded-full bg-line" />
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-panel-strong px-2.5 py-0.5 text-xs font-medium text-fg">{title}</span>
        {execution && (
          <span className={`text-xs ${execution.status === "COMPLETED" ? "text-hue-emerald" : "text-danger"}`}>
            {execution.status === "COMPLETED" ? "Completed" : "Failed"} · {durationLabel(execution.started_at, execution.completed_at)}
          </span>
        )}
        <time dateTime={step.created_at} className="ml-auto text-xs text-fg-subtle">
          {new Date(step.created_at).toLocaleTimeString()}
        </time>
      </div>
      {step.decision?.model_text && <p className="mt-2 text-sm italic text-fg-muted">&ldquo;{step.decision.model_text}&rdquo;</p>}
      {execution && <p className="mt-2 text-sm text-fg">{execution.summary}</p>}
      {step.kind === "FORCED_FINISH" && <p className="mt-2 text-sm text-fg-muted">The resident used up their turns without finishing, so the idea was closed.</p>}
      {execution && <Exchange execution={execution} />}
    </li>
  );
}
