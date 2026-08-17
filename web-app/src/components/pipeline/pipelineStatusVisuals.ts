// Maps CodePipeline's own status strings (passed through as-is by the
// backend — models/pipelineStatus.ts) to a visual treatment. Reuses the
// same validated status palette established for ingestion metrics
// (components/ingestion/palette.ts) rather than re-deriving one, per
// 2-pipeline-monitoring.md §8.
import { IV_COLORS } from "../ingestion/palette";

export type StatusCategory = "success" | "failure" | "inProgress" | "neutral";

export interface StatusVisual {
  category: StatusCategory;
  color: string;
  label: string;
}

const NEUTRAL_GRAY = "#898781"; // palette.md's mode-invariant muted/axis token — not a series color, so not in IV_COLORS

/** The category→color mapping, shared by getStatusVisual and any rollup (e.g. a per-stage summary) that only has a category, not a raw status string. */
export function getCategoryColor(category: StatusCategory): string {
  switch (category) {
    case "success":
      return IV_COLORS.statusGood;
    case "failure":
      return IV_COLORS.statusCritical;
    case "inProgress":
      return IV_COLORS.seriesIngested;
    default:
      return NEUTRAL_GRAY;
  }
}

/**
 * CodePipeline's status vocabulary spans action statuses
 * (InProgress/Succeeded/Failed/Cancelled/Stopped/Superseded/Abandoned)
 * and a slightly different execution-status set — folded into four visual
 * categories here since the *meaning* (good/bad/running/other) is what
 * the UI needs, not the exact enum value (that stays visible as the
 * label text).
 */
export function getStatusVisual(status: string | null): StatusVisual {
  if (status === null) {
    return { category: "neutral", color: getCategoryColor("neutral"), label: "Not run yet" };
  }
  switch (status) {
    case "Succeeded":
      return { category: "success", color: getCategoryColor("success"), label: "Succeeded" };
    case "Failed":
      return { category: "failure", color: getCategoryColor("failure"), label: "Failed" };
    case "InProgress":
      return { category: "inProgress", color: getCategoryColor("inProgress"), label: "In progress" };
    default:
      // Cancelled / Stopped / Superseded / Abandoned / anything future —
      // not a failure, just not currently meaningful to call out in color.
      return { category: "neutral", color: getCategoryColor("neutral"), label: status };
  }
}
