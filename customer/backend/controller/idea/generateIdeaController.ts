import { logError, logInfo } from "../../logger";
import { IdeaWorkerEventSchema } from "../../models/ideaWorkerEvent";
import { runIdeaWorker, type IdeaWorkerOutcome } from "../../service/idea/ideaGenerationService";

/**
 * The idea worker (§3 Flow B), invoked by one EventBridge schedule per
 * resident with `{ persona_id }`. A malformed input is logged and dropped,
 * since retrying cannot fix it; any other error is rethrown so the
 * schedule's retry policy tries again (a Bedrock throttle is a retry, not
 * a failure — decision 9).
 */
export const generateIdeaController = async (event: unknown): Promise<IdeaWorkerOutcome | { outcome: "REJECTED" }> => {
  logInfo("GenerateIdeaControllerInvoked", { event });
  const parsed = IdeaWorkerEventSchema.safeParse(event);
  if (!parsed.success) {
    logError("GenerateIdeaControllerValidationFailed", { issues: parsed.error.issues });
    return { outcome: "REJECTED" };
  }
  try {
    const result = await runIdeaWorker(parsed.data);
    logInfo("GenerateIdeaControllerCompleted", { result });
    return result;
  } catch (err) {
    logError("GenerateIdeaControllerFailed", { personaId: parsed.data.persona_id, error: err instanceof Error ? err.message : err });
    throw err;
  }
};
