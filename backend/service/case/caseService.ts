import { logWarn } from "../../logger";
import { CreateCaseInputSchema, type CreateCaseInput } from "../../models/case";
import { ValidationError } from "../../models/errors";

/**
 * Stub: no Cases table, no CaseDao yet — the documented seam for v2's
 * Case persistence (v1-prod-deployment.md Q4). No live caller today: a
 * `bbl` miss is now an Order rejected `LOCATION_UNRESOLVED`, and
 * evaluation's `CASE` outcome is never returned by the v1 rule. Logs and
 * returns; throws only for a malformed `input`, a genuine caller bug.
 */
export async function createCase(input: CreateCaseInput): Promise<void> {
  const parsed = CreateCaseInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError("Invalid createCase input", parsed.error.issues);
  }
  logWarn("CaseCreationStub", { input: parsed.data });
}
