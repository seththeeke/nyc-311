import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CronScheduleBuilder } from "../../../src/components/query/CronScheduleBuilder";

describe("CronScheduleBuilder", () => {
  it("defaults to daily and reports the initial cron expression on mount", () => {
    const onChange = vi.fn();
    render(<CronScheduleBuilder onChange={onChange} />);

    expect(screen.getByText("cron(0 9 * * ? *)")).toBeInTheDocument();
  });

  it("updates the cron expression when the hour/minute change under Daily", async () => {
    const onChange = vi.fn();
    render(<CronScheduleBuilder onChange={onChange} />);
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText("Hour (UTC)"));
    await user.type(screen.getByLabelText("Hour (UTC)"), "14");

    expect(onChange).toHaveBeenLastCalledWith("cron(0 14 * * ? *)");
  });

  it("switches to Hourly and shows only the minute field", async () => {
    const onChange = vi.fn();
    render(<CronScheduleBuilder onChange={onChange} />);
    const user = userEvent.setup();

    await user.selectOptions(screen.getByLabelText("Cadence"), "hourly");
    expect(screen.queryByLabelText("Hour (UTC)")).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText("Minute past the hour"));
    await user.type(screen.getByLabelText("Minute past the hour"), "15");

    expect(onChange).toHaveBeenLastCalledWith("cron(15 * * * ? *)");
  });

  it("switches to Weekly and includes the selected day of week", async () => {
    const onChange = vi.fn();
    render(<CronScheduleBuilder onChange={onChange} />);
    const user = userEvent.setup();

    await user.selectOptions(screen.getByLabelText("Cadence"), "weekly");
    await user.selectOptions(screen.getByLabelText("Day"), "TUE");

    expect(onChange).toHaveBeenLastCalledWith("cron(0 9 ? * TUE *)");
  });

  it("switches to Custom and passes the raw expression through", async () => {
    const onChange = vi.fn();
    render(<CronScheduleBuilder onChange={onChange} />);
    const user = userEvent.setup();

    await user.selectOptions(screen.getByLabelText("Cadence"), "custom");
    await user.type(screen.getByLabelText("Raw cron expression"), "cron(0/5 * * * ? *)");

    expect(onChange).toHaveBeenLastCalledWith("cron(0/5 * * * ? *)");
  });
});
