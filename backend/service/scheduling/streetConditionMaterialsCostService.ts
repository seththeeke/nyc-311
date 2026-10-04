import { logWarn } from "../../logger";
import type { Order } from "../../models/order";
import type { Request } from "../../models/request";
import type { MaterialsCostEstimator } from "./materialsCostService";

/* Known long-tail descriptors and any new or null one. */
const DEFAULT_COST_USD = 200;

/**
 * Expected materials cost in USD for one Street Condition `descriptor` — a
 * constant per job type (v1-prod-deployment.md Q5). Inspection-only
 * descriptors use no materials.
 */
function streetConditionMaterialsCostUsd(descriptor: string | null): number {
  switch (descriptor) {
    case "Pothole":
      return 75;
    case "Cave-in":
      return 600;
    case "Defective Hardware":
      return 250;
    case "Rough, Pitted or Cracked Roads":
      return 400;
    case "Failed Street Repair":
      return 200;
    case "Plate Condition - Noisy":
    case "Plate Condition - Shifted":
    case "Plate Condition - Open":
    case "Plate Condition - Anti-Skid":
      return 50;
    case "Line/Marking - Faded":
    case "Line/Marking - After Repaving":
      return 150;
    case "Crash Cushion Defect":
    case "Guard Rail - Street":
      return 500;
    case "Blocked - Construction":
    case "Dumpster - Construction Waste":
    case "Unsafe Worksite":
      return 0;
    case "Depression Maintenance":
    case "Wear & Tear":
    case "Hummock":
    case "General Bad Condition":
      return DEFAULT_COST_USD;
    default:
      logWarn("UnknownDescriptor", { descriptor, estimate: "MATERIALS_COST", fallback: DEFAULT_COST_USD });
      return DEFAULT_COST_USD;
  }
}

/** v1 {@link MaterialsCostEstimator}: a constant expectation per Street Condition descriptor. */
export const streetConditionMaterialsCostEstimator: MaterialsCostEstimator = {
  costModel: "BRUTE_FORCE",
  async estimateCost(_order: Order, request: Request): Promise<number> {
    return streetConditionMaterialsCostUsd(request.descriptor);
  },
};
