import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../service/idea/ideaGenerationService", () => ({ runIdeaWorker: vi.fn() }));

import { generateIdeaController } from "../../../controller/idea/generateIdeaController";
import { runIdeaWorker } from "../../../service/idea/ideaGenerationService";

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.clearAllMocks());

describe("generateIdeaController", () => {
  it("runs the worker for the scheduled resident", async () => {
    vi.mocked(runIdeaWorker).mockResolvedValue({ outcome: "CREATED", ideaId: "01X" });
    await expect(generateIdeaController({ persona_id: "hawthorn" })).resolves.toEqual({ outcome: "CREATED", ideaId: "01X" });
    expect(runIdeaWorker).toHaveBeenCalledWith({ persona_id: "hawthorn" });
  });

  it("drops a malformed input rather than retrying it", async () => {
    await expect(generateIdeaController({})).resolves.toEqual({ outcome: "REJECTED" });
    expect(runIdeaWorker).not.toHaveBeenCalled();
  });

  it("rethrows a failure so the schedule retries", async () => {
    vi.mocked(runIdeaWorker).mockRejectedValueOnce(new Error("ThrottlingException")).mockRejectedValueOnce("odd");
    await expect(generateIdeaController({ persona_id: "hawthorn" })).rejects.toThrow("ThrottlingException");
    await expect(generateIdeaController({ persona_id: "hawthorn" })).rejects.toBe("odd");
  });
});
