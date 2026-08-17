import { useState, type ReactElement } from "react";
import type { PipelineAction, PipelineStage } from "../../models/pipelineStatus";
import { getStatusVisual } from "./pipelineStatusVisuals";
import { PipelineStageSummary } from "./PipelineStageSummary";
import { PipelineStatusIcon } from "./PipelineStatusIcon";
import { StageLayoutToggle, type StageLayout } from "./StageLayoutToggle";

export interface PipelineStagesViewProps {
  stages: PipelineStage[];
}

function ActionRow({ action }: { action: PipelineAction }): ReactElement {
  const visual = getStatusVisual(action.status);
  return (
    <li className="flex min-w-0 items-center gap-1.5 text-xs">
      <PipelineStatusIcon category={visual.category} className="h-3 w-3 shrink-0" style={{ color: visual.color }} />
      <span className="min-w-0 flex-1 truncate text-slate-700" title={action.actionName}>
        {action.actionName}
      </span>
      {/* The icon (a distinct glyph shape per category, not just a color)
          already communicates status — this text stays for screen
          readers instead of visibly duplicating it next to the name. */}
      <span className="sr-only">{visual.label}</span>
    </li>
  );
}

function StageCard({ stage }: { stage: PipelineStage }): ReactElement {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-2">
      <h3 className="truncate text-[0.65rem] font-semibold tracking-wide text-slate-500 uppercase">
        {stage.stageName}
      </h3>
      <ul className="mt-1.5 flex flex-col gap-1">
        {stage.actions.map((action) => (
          <ActionRow key={action.actionName} action={action} />
        ))}
      </ul>
    </div>
  );
}

function HorizontalStageList({ stages }: { stages: PipelineStage[] }): ReactElement {
  return (
    <div data-testid="stage-layout-list" className="flex gap-2 overflow-x-auto pb-1">
      {stages.map((stage, index) => (
        <div key={stage.stageName} className="flex items-center gap-2">
          {index > 0 && (
            <span aria-hidden="true" className="shrink-0 text-slate-300">
              →
            </span>
          )}
          <div className="w-32 shrink-0">
            <StageCard stage={stage} />
          </div>
        </div>
      ))}
    </div>
  );
}

function VerticalStageList({ stages }: { stages: PipelineStage[] }): ReactElement {
  return (
    <div data-testid="stage-layout-list" className="flex max-w-[14rem] flex-col gap-2">
      {stages.map((stage, index) => (
        <div key={stage.stageName} className="flex flex-col gap-2">
          {index > 0 && (
            <span aria-hidden="true" className="text-slate-300">
              ↓
            </span>
          )}
          <StageCard stage={stage} />
        </div>
      ))}
    </div>
  );
}

// No hardcoded stage/action names anywhere — whatever the API returns is
// rendered, in order (2-pipeline-monitoring.md §4's "full proof" property:
// a new pipeline stage shows up automatically, zero code change here).
export function PipelineStagesView({ stages }: PipelineStagesViewProps): ReactElement {
  const [layout, setLayout] = useState<StageLayout>("horizontal");

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <PipelineStageSummary stages={stages} />
        <StageLayoutToggle layout={layout} onChange={setLayout} />
      </div>
      {layout === "vertical" ? <VerticalStageList stages={stages} /> : <HorizontalStageList stages={stages} />}
    </div>
  );
}
