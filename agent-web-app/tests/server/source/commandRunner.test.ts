import { describe, expect, it } from "vitest";
import { runCommand } from "../../../server/source/commandRunner.ts";

describe("runCommand", () => {
  it("returns stdout and exit 0 on success", async () => {
    expect(await runCommand("echo", ["hi"])).toEqual({ stdout: "hi\n", code: 0 });
  });

  it("returns the exit code on failure, and 1 when the command doesn't exist", async () => {
    expect((await runCommand("sh", ["-c", "exit 3"])).code).toBe(3);
    expect((await runCommand("no-such-command-xyz", [])).code).toBe(1);
  });
});
