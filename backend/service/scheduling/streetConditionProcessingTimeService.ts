import { logWarn } from "../../logger";
import type { Order } from "../../models/order";
import type { Request } from "../../models/request";
import type { ProcessingTimeEstimator } from "./processingTimeService";

/*
 * Inspection-only visits: descriptors that aren't a crew repair (a
 * construction site, a dumpster, a worksite) still get a short truck visit
 * rather than being rejected (v1-prod-deployment.md Q5).
 */
const INSPECTION_MINUTES = 15;

/* Known long-tail descriptors and any new or null one. */
const DEFAULT_MINUTES = 60;

/**
 * Expected on-site minutes for one Street Condition `descriptor` — a
 * constant per job type (v1-prod-deployment.md Q5). Execution multiplies
 * this by its uniform [1, 2) variance factor.
 */
function streetConditionProcessingMinutes(descriptor: string | null): number {
  switch (descriptor) {
    case "Pothole":
      return 30;
    case "Cave-in":
      return 120;
    case "Defective Hardware":
      return 60;
    case "Rough, Pitted or Cracked Roads":
      return 90;
    case "Failed Street Repair":
      return 60;
    case "Plate Condition - Noisy":
    case "Plate Condition - Shifted":
    case "Plate Condition - Open":
    case "Plate Condition - Anti-Skid":
      return 30;
    case "Line/Marking - Faded":
    case "Line/Marking - After Repaving":
      return 45;
    case "Crash Cushion Defect":
    case "Guard Rail - Street":
      return 90;
    case "Blocked - Construction":
    case "Dumpster - Construction Waste":
    case "Unsafe Worksite":
      return INSPECTION_MINUTES;
    case "Depression Maintenance":
    case "Wear & Tear":
    case "Hummock":
    case "General Bad Condition":
      return DEFAULT_MINUTES;
    default:
      logWarn("UnknownDescriptor", { descriptor, estimate: "PROCESSING_MINUTES", fallback: DEFAULT_MINUTES });
      return DEFAULT_MINUTES;
  }
}

/** v1 {@link ProcessingTimeEstimator}: a constant expectation per Street Condition descriptor. */
export const streetConditionProcessingTimeEstimator: ProcessingTimeEstimator = {
  async estimateMinutes(_order: Order, request: Request): Promise<number> {
    return streetConditionProcessingMinutes(request.descriptor);
  },
};
