import { execFile } from "node:child_process";

export interface CommandResult {
  stdout: string;
  code: number;
}

/** Runs a read-only command (`launchctl`, `plutil`, `git`); stubbed in tests. Never throws: a failure is a non-zero `code`. */
export type CommandRunner = (command: string, args: string[]) => Promise<CommandResult>;

export const runCommand: CommandRunner = (command, args) =>
  new Promise((resolve) => {
    execFile(command, args, { maxBuffer: 16 * 1024 * 1024 }, (error, stdout) => {
      const code = error ? (typeof error.code === "number" ? error.code : 1) : 0;
      resolve({ stdout: String(stdout), code });
    });
  });
