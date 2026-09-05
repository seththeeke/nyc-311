/*
 * Maps WarehouseJobRun's status to a visual treatment. Reuses the same
 * validated status-category palette already established for pipeline
 * status (components/pipeline/pipelineStatusVisuals.ts) rather than
 * re-deriving one — RUNNING/SUCCEEDED/FAILED map cleanly onto the same
 * inProgress/success/failure categories CodePipeline's own statuses do.
 */
import { getCategoryColor, type StatusCategory } from "../pipeline/pipelineStatusVisuals";
import type { WarehouseJobRunStatus } from "../../models/warehouseJobRun";

export interface StatusVisual {
  category: StatusCategory;
  color: string;
  label: string;
}

export function getJobRunStatusVisual(status: WarehouseJobRunStatus): StatusVisual {
  switch (status) {
    case "SUCCEEDED":
      return { category: "success", color: getCategoryColor("success"), label: "Succeeded" };
    case "FAILED":
      return { category: "failure", color: getCategoryColor("failure"), label: "Failed" };
    case "RUNNING":
      return { category: "inProgress", color: getCategoryColor("inProgress"), label: "Running" };
  }
}
