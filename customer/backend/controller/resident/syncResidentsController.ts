import { logError, logInfo } from "../../logger";
import { ResidentSyncEventSchema } from "../../models/residentSyncEvent";
import { RESIDENT_SEEDS } from "../../service/resident/residentSeeds";
import { syncResidents } from "../../service/resident/residentSyncService";

/* One fixed id: the sync is a single logical resource, so CloudFormation never sees a replacement. */
export const RESIDENT_SYNC_RESOURCE_ID = "resident-seed-sync";

export interface ResidentSyncResponse {
  PhysicalResourceId: string;
  Data?: Record<string, string>;
}

/**
 * The seed sync custom resource (§2 customer side, decision 2), invoked
 * by CloudFormation through the CDK provider framework on every deploy
 * that changes a seed or the prompt. A thrown error fails the deploy, so
 * a malformed seed never reaches Prod. Delete does nothing: residents
 * outlive the stack's resource, as their ideas do.
 */
export const syncResidentsController = async (event: unknown): Promise<ResidentSyncResponse> => {
  logInfo("SyncResidentsControllerInvoked", { event });
  const parsed = ResidentSyncEventSchema.safeParse(event);
  if (!parsed.success) {
    logError("SyncResidentsControllerValidationFailed", { issues: parsed.error.issues });
    throw new Error("Malformed custom resource event");
  }
  if (parsed.data.RequestType === "Delete") {
    logInfo("SyncResidentsControllerDeleteIgnored", {});
    return { PhysicalResourceId: RESIDENT_SYNC_RESOURCE_ID };
  }
  const outcomes = await syncResidents(RESIDENT_SEEDS);
  const response = { PhysicalResourceId: RESIDENT_SYNC_RESOURCE_ID, Data: outcomes };
  logInfo("SyncResidentsControllerCompleted", { response });
  return response;
};
