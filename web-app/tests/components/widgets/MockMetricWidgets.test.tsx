import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  MeanTimeToResolveWidget,
  MedianTimeToResolveWidget,
  ServicedWidget,
  TotalCostEstWidget,
  TotalRequestsWidget,
} from "../../../src/components/widgets/mock/MockMetricWidgets";

describe("mock metric widgets", () => {
  it.each([
    ["Total Requests", TotalRequestsWidget, "4,892"],
    ["Serviced", ServicedWidget, "4,625"],
    ["Total Cost (Est.)", TotalCostEstWidget, "$421,380"],
    ["Mean Time to Resolve", MeanTimeToResolveWidget, "2h 14m"],
    ["Median Time to Resolve", MedianTimeToResolveWidget, "1h 38m"],
  ])("%s renders its hard-coded sample value", (_label, Widget, value) => {
    render(<Widget />);
    expect(screen.getByText(value)).toBeInTheDocument();
  });
});
