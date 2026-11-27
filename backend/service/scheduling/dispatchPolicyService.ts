import { logInfo, logWarn } from "../../logger";
import { getTreatment } from "../featureFlag/featureFlagService";
import { DISPATCH_POLICIES, DISPATCH_POLICY_FLAG_KEY, type DispatchPolicy } from "../../models/dispatchDecision";

/* Policies this build can run. T1 joins in Leg 1b, T2 in Leg 5 (20-ml-driver-assignment.md §8). */
const IMPLEMENTED_POLICIES: readonly DispatchPolicy[] = ["C"];

export interface ResolvedDispatchPolicy {
  /** What the flag returned (C on any read failure, via getTreatment's fallback). */
  flagTreatment: DispatchPolicy;
  /** What this pass runs: the flag's treatment if implemented, else C. */
  appliedPolicy: DispatchPolicy;
}

export interface ResolveDispatchPolicyDeps {
  getTreatment?: typeof getTreatment;
}

function isDispatchPolicy(value: string): value is DispatchPolicy {
  return (DISPATCH_POLICIES as readonly string[]).includes(value);
}

/**
 * Reads DISPATCH_POLICY once for a scheduling pass (§3.1). Never throws:
 * getTreatment falls back to C itself, and a treatment this build doesn't
 * implement yet runs as C with a WARN, so the stamp always names the
 * policy that actually ran.
 */
export async function resolveDispatchPolicy(deps: ResolveDispatchPolicyDeps = {}): Promise<ResolvedDispatchPolicy> {
  const read = deps.getTreatment ?? getTreatment;
  const treatment = await read(DISPATCH_POLICY_FLAG_KEY, {}, { fallback: "C", treatments: [...DISPATCH_POLICIES] });
  const flagTreatment: DispatchPolicy = isDispatchPolicy(treatment) ? treatment : "C";

  if (!IMPLEMENTED_POLICIES.includes(flagTreatment)) {
    logWarn("DispatchPolicyNotImplemented", { flagTreatment, appliedPolicy: "C" });
    return { flagTreatment, appliedPolicy: "C" };
  }
  logInfo("DispatchPolicyResolved", { flagTreatment, appliedPolicy: flagTreatment });
  return { flagTreatment, appliedPolicy: flagTreatment };
}
