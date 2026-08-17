import { describe, expect, it } from "vitest";
import { getCategoryColor, getStatusVisual } from "../../../src/components/pipeline/pipelineStatusVisuals";
import { IV_COLORS } from "../../../src/components/ingestion/palette";

describe("getStatusVisual", () => {
  it("maps Succeeded to the success category and status-good color", () => {
    expect(getStatusVisual("Succeeded")).toEqual({
      category: "success",
      color: IV_COLORS.statusGood,
      label: "Succeeded",
    });
  });

  it("maps Failed to the failure category and status-critical color", () => {
    expect(getStatusVisual("Failed")).toEqual({
      category: "failure",
      color: IV_COLORS.statusCritical,
      label: "Failed",
    });
  });

  it("maps InProgress to the inProgress category", () => {
    expect(getStatusVisual("InProgress")).toMatchObject({ category: "inProgress", label: "In progress" });
  });

  it("maps null (never run) to a neutral category with a fixed label", () => {
    expect(getStatusVisual(null)).toMatchObject({ category: "neutral", label: "Not run yet" });
  });

  it("maps any other status (Cancelled, Stopped, Superseded, ...) to neutral, passing the label through", () => {
    expect(getStatusVisual("Cancelled")).toMatchObject({ category: "neutral", label: "Cancelled" });
    expect(getStatusVisual("Superseded")).toMatchObject({ category: "neutral", label: "Superseded" });
  });
});

describe("getCategoryColor", () => {
  it("maps each category to its reserved status color", () => {
    expect(getCategoryColor("success")).toBe(IV_COLORS.statusGood);
    expect(getCategoryColor("failure")).toBe(IV_COLORS.statusCritical);
    expect(getCategoryColor("inProgress")).toBe(IV_COLORS.seriesIngested);
  });

  it("maps neutral to the same muted gray getStatusVisual uses for it", () => {
    expect(getCategoryColor("neutral")).toBe(getStatusVisual("Cancelled").color);
  });
});
