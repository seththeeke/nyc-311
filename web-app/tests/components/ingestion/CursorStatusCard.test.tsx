import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CursorStatusCard } from "../../../src/components/ingestion/CursorStatusCard";
import type { IngestionCursorStatus } from "../../../src/models/pollerMetrics";

describe("CursorStatusCard", () => {
  it("shows a no-cursor message when cursor is null", () => {
    render(<CursorStatusCard cursor={null} />);

    expect(screen.getByText("No ingestion cursor yet — the poller hasn't completed a run.")).toBeInTheDocument();
  });

  it("renders Healthy for a non-stale cursor", () => {
    const cursor: IngestionCursorStatus = {
      last_watermark: "2026-08-15T18:00:00",
      resume_offset: null,
      lag_hours: 72,
      is_stale: false,
    };
    render(<CursorStatusCard cursor={cursor} />);

    expect(screen.getByText("Healthy")).toBeInTheDocument();
    expect(screen.getByText("72h")).toBeInTheDocument();
    expect(screen.getByText("Drained")).toBeInTheDocument();
  });

  it("renders Stalled and the numeric resume_offset for a stale, mid-window cursor", () => {
    const cursor: IngestionCursorStatus = {
      last_watermark: "2026-08-10T00:00:00",
      resume_offset: 72000,
      lag_hours: 288,
      is_stale: true,
    };
    render(<CursorStatusCard cursor={cursor} />);

    expect(screen.getByText("Stalled")).toBeInTheDocument();
    expect(screen.getByText("288h")).toBeInTheDocument();
    expect(screen.getByText("72,000")).toBeInTheDocument();
  });

  it("renders em dashes for a cursor with a null watermark and lag", () => {
    const cursor: IngestionCursorStatus = {
      last_watermark: null,
      resume_offset: null,
      lag_hours: null,
      is_stale: false,
    };
    render(<CursorStatusCard cursor={cursor} />);

    expect(screen.getAllByText("—")).toHaveLength(2);
  });
});
