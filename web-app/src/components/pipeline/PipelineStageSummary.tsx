import type { ReactElement } from "react";
import type { PipelineStage } from "../../models/pipelineStatus";
import { getCategoryColor, getStatusVisual, type StatusCategory } from "./pipelineStatusVisuals";
import { PipelineStatusIcon } from "./PipelineStatusIcon";

export interface PipelineStageSummaryProps {
  stages: PipelineStage[];
}

/*
 * Rolls a stage's actions up into one glance-able category: failed if
 * anything in it failed, in-progress if anything is still running,
 * succeeded only if everything is, neutral otherwise (not yet run, or a
 * mixed terminal state like a Cancelled action).
 */
function aggregateStageCategory(stage: PipelineStage): StatusCategory {
  const categories = stage.actions.map((action) => getStatusVisual(action.status).category);
  if (categories.includes("failure")) return "failure";
  if (categories.includes("inProgress")) return "inProgress";
  if (categories.length > 0 && categories.every((category) => category === "success")) return "success";
  return "neutral";
}

function categoryLabel(category: StatusCategory): string {
  switch (category) {
    case "success":
      return "Succeeded";
    case "failure":
      return "Failed";
    case "inProgress":
      return "In progress";
    default:
      return "Not run yet";
  }
}

/*
 * An icon-only, at-a-glance pill — no stage names, just one status glyph
 * per stage in sequence — living inside the Stages view itself rather
 * than as its own separate, text-labeled section.
 */
export function PipelineStageSummary({ stages }: PipelineStageSummaryProps): ReactElement {
  return (
    <ol className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 shadow-sm">
      {stages.map((stage, index) => {
        const category = aggregateStageCategory(stage);
        return (
          <li key={stage.stageName} className="flex items-center gap-1">
            {index > 0 && (
              <span aria-hidden="true" className="text-[10px] text-slate-300">
                →
              </span>
            )}
            <PipelineStatusIcon category={category} className="h-3.5 w-3.5 shrink-0" style={{ color: getCategoryColor(category) }} />
            <span className="sr-only">
              {stage.stageName}: {categoryLabel(category)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
