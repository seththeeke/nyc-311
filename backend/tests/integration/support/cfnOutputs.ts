import { execFileSync } from "node:child_process";

const AWS_PROFILE = "nyc311";

/**
 * Looks up one named `CfnOutput` on a deployed stack — the same
 * lookup-by-stack-output pattern `targets.ts` and
 * `test-scripts/*.py` already use elsewhere in this project, factored out
 * here so `testAdminAuth.ts` doesn't duplicate it. Local/manual-run only —
 * the pipeline always injects known outputs directly via
 * `envFromCfnOutputs` instead of calling this.
 */
export function lookupStackOutput(stackName: string, outputKey: string): string {
  const output = execFileSync(
    "aws",
    ["cloudformation", "describe-stacks", "--stack-name", stackName, "--profile", AWS_PROFILE, "--output", "json"],
    { encoding: "utf8" }
  );
  const stacks = JSON.parse(output).Stacks as { Outputs?: { OutputKey: string; OutputValue: string }[] }[];
  const value = stacks[0]?.Outputs?.find((o) => o.OutputKey === outputKey)?.OutputValue;
  if (!value) {
    throw new Error(`No ${outputKey} output on ${stackName} — has it been deployed yet?`);
  }
  return value;
}
