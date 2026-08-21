import { logWarn } from "../../logger";
import { CreateCaseInputSchema, type CreateCaseInput } from "../../models/case";
import { ValidationError } from "../../models/errors";

/**
 * Stub: no Cases table, no CaseDao yet — this only establishes the
 * interface a real caller (e.g. `resolveLocation` on a `bbl` miss) needs,
 * so it doesn't have to change when Case persistence is actually built.
 * Logs and returns; never throws for a missing downstream — only for a
 * malformed `input`, since that's a genuine caller bug worth surfacing now.
 */
export async function createCase(input: CreateCaseInput): Promise<void> {
  const parsed = CreateCaseInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError("Invalid createCase input", parsed.error.issues);
  }
  logWarn("CaseCreationStub", { input: parsed.data });
}
