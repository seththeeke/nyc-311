import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../service/action/ideaActionService", () => ({ runIdeaActions: vi.fn() }));

import { runIdeaActionsController } from "../../../controller/action/runIdeaActionsController";
import { runIdeaActions } from "../../../service/action/ideaActionService";

const record = (body: string, messageId = "m1") => ({ messageId, body });

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(runIdeaActions).mockReset();
});
afterEach(() => vi.restoreAllMocks());

describe("runIdeaActionsController", () => {
  it("works each idea in the batch", async () => {
    vi.mocked(runIdeaActions).mockResolvedValue({ outcome: "FINISHED", status: "SATISFIED", steps: 2 });
    const outcomes = await runIdeaActionsController({ Records: [record('{"persona_id":"hawthorn","idea_id":"01X"}')] });
    expect(runIdeaActions).toHaveBeenCalledWith({ persona_id: "hawthorn", idea_id: "01X" });
    expect(outcomes).toEqual([{ outcome: "FINISHED", status: "SATISFIED", steps: 2 }]);
  });

  it("drops a malformed event or message, since retrying can't fix it", async () => {
    await expect(runIdeaActionsController({ nope: true })).resolves.toEqual([]);
    await expect(runIdeaActionsController({ Records: [record("not json"), record('{"persona_id":"x"}', "m2")] })).resolves.toEqual([]);
    expect(runIdeaActions).not.toHaveBeenCalled();
  });

  it.each([new Error("throttled"), "throttled"])("rethrows a failure (%s) so the queue redelivers", async (failure) => {
    vi.mocked(runIdeaActions).mockRejectedValue(failure);
    await expect(runIdeaActionsController({ Records: [record('{"persona_id":"hawthorn","idea_id":"01X"}')] })).rejects.toBe(failure);
  });
});
