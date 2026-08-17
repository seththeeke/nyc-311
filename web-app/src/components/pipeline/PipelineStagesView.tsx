import type { ReactElement } from "react";
import type { PipelineAction, PipelineStage } from "../../models/pipelineStatus";
import { getStatusVisual } from "./pipelineStatusVisuals";
import { PipelineStatusIcon } from "./PipelineStatusIcon";

export interface PipelineStagesViewProps {
  stages: PipelineStage[];
}

function ActionRow({ action }: { action: PipelineAction }): ReactElement {
  const visual = getStatusVisual(action.status);
  return (
    <li className="flex items-center gap-2 text-sm">
      <PipelineStatusIcon category={visual.category} className="h-4 w-4 shrink-0" style={{ color: visual.color }} />
      <span className="text-slate-700">{action.actionName}</span>
      <span className="text-xs text-slate-400">{visual.label}</span>
    </li>
  );
}

function StageCard({ stage }: { stage: PipelineStage }): ReactElement {
  return (
    <div className="w-56 shrink-0 rounded-lg border border-slate-200 bg-white p-3">
      <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{stage.stageName}</h3>
      <ul className="mt-2 flex flex-col gap-1.5">
        {stage.actions.map((action) => (
          <ActionRow key={action.actionName} action={action} />
        ))}
      </ul>
    </div>
  );
}

// No hardcoded stage/action names anywhere — whatever the API returns is
// rendered, in order (2-pipeline-monitoring.md §4's "full proof" property:
// a new pipeline stage shows up automatically, zero code change here).
export function PipelineStagesView({ stages }: PipelineStagesViewProps): ReactElement {
  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {stages.map((stage, index) => (
        <div key={stage.stageName} className="flex items-center gap-3">
          {index > 0 && (
            <span aria-hidden="true" className="shrink-0 text-slate-300">
              →
            </span>
          )}
          <StageCard stage={stage} />
        </div>
      ))}
    </div>
  );
}
