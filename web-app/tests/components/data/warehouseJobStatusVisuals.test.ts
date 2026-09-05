import { describe, expect, it } from "vitest";
import { getJobRunStatusVisual } from "../../../src/components/data/warehouseJobStatusVisuals";
import { getCategoryColor } from "../../../src/components/pipeline/pipelineStatusVisuals";

describe("getJobRunStatusVisual", () => {
  it("maps SUCCEEDED to the success category and status-good color", () => {
    expect(getJobRunStatusVisual("SUCCEEDED")).toEqual({
      category: "success",
      color: getCategoryColor("success"),
      label: "Succeeded",
    });
  });

  it("maps FAILED to the failure category and status-critical color", () => {
    expect(getJobRunStatusVisual("FAILED")).toEqual({
      category: "failure",
      color: getCategoryColor("failure"),
      label: "Failed",
    });
  });

  it("maps RUNNING to the inProgress category", () => {
    expect(getJobRunStatusVisual("RUNNING")).toEqual({
      category: "inProgress",
      color: getCategoryColor("inProgress"),
      label: "Running",
    });
  });
});
