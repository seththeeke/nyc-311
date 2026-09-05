import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JobRunFilters } from "../../../src/components/data/JobRunFilters";

describe("JobRunFilters", () => {
  it("renders labeled status/trigger selects defaulting to 'All' and a job-name input", () => {
    render(
      <JobRunFilters
        status=""
        trigger=""
        jobName=""
        onStatusChange={vi.fn()}
        onTriggerChange={vi.fn()}
        onJobNameChange={vi.fn()}
      />
    );

    expect(screen.getByLabelText("Status")).toHaveValue("");
    expect(screen.getByLabelText("Trigger")).toHaveValue("");
    expect(screen.getByLabelText("Job name")).toHaveValue("");
  });

  it("calls onStatusChange with the selected status", async () => {
    const onStatusChange = vi.fn();
    render(
      <JobRunFilters
        status=""
        trigger=""
        jobName=""
        onStatusChange={onStatusChange}
        onTriggerChange={vi.fn()}
        onJobNameChange={vi.fn()}
      />
    );

    await userEvent.selectOptions(screen.getByLabelText("Status"), "FAILED");

    expect(onStatusChange).toHaveBeenCalledWith("FAILED");
  });

  it("calls onTriggerChange with the selected trigger", async () => {
    const onTriggerChange = vi.fn();
    render(
      <JobRunFilters
        status=""
        trigger=""
        jobName=""
        onStatusChange={vi.fn()}
        onTriggerChange={onTriggerChange}
        onJobNameChange={vi.fn()}
      />
    );

    await userEvent.selectOptions(screen.getByLabelText("Trigger"), "MANUAL");

    expect(onTriggerChange).toHaveBeenCalledWith("MANUAL");
  });

  it("calls onJobNameChange as the job-name input changes", async () => {
    const onJobNameChange = vi.fn();
    render(
      <JobRunFilters
        status=""
        trigger=""
        jobName=""
        onStatusChange={vi.fn()}
        onTriggerChange={vi.fn()}
        onJobNameChange={onJobNameChange}
      />
    );

    await userEvent.type(screen.getByLabelText("Job name"), "R");

    expect(onJobNameChange).toHaveBeenCalledWith("R");
  });

  it("reflects the given status/trigger/jobName values", () => {
    render(
      <JobRunFilters
        status="SUCCEEDED"
        trigger="SCHEDULED"
        jobName="ORDER_VOLUME"
        onStatusChange={vi.fn()}
        onTriggerChange={vi.fn()}
        onJobNameChange={vi.fn()}
      />
    );

    expect(screen.getByLabelText("Status")).toHaveValue("SUCCEEDED");
    expect(screen.getByLabelText("Trigger")).toHaveValue("SCHEDULED");
    expect(screen.getByLabelText("Job name")).toHaveValue("ORDER_VOLUME");
  });
});
