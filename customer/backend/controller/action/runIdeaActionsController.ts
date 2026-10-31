import { logError, logInfo } from "../../logger";
import { IdeaActionMessageSchema, SqsEventSchema } from "../../models/ideaActionMessage";
import { runIdeaActions, type IdeaActionOutcome } from "../../service/action/ideaActionService";

/**
 * The action worker (docs/16-resident-action-models.md §5.2), fed one
 * message at a time by IdeaActions-Prod. A malformed message is logged
 * and dropped, since retrying cannot fix it; any other error is rethrown
 * so the queue redelivers, and the loop resumes from its saved steps.
 */
export const runIdeaActionsController = async (event: unknown): Promise<IdeaActionOutcome[]> => {
  logInfo("RunIdeaActionsControllerInvoked", { event });
  const parsedEvent = SqsEventSchema.safeParse(event);
  if (!parsedEvent.success) {
    logError("RunIdeaActionsControllerValidationFailed", { issues: parsedEvent.error.issues });
    return [];
  }
  const outcomes: IdeaActionOutcome[] = [];
  for (const record of parsedEvent.data.Records) {
    let json: unknown;
    try {
      json = JSON.parse(record.body);
    } catch {
      json = null;
    }
    const message = IdeaActionMessageSchema.safeParse(json);
    if (!message.success) {
      logError("RunIdeaActionsControllerMessageRejected", { messageId: record.messageId, body: record.body });
      continue;
    }
    try {
      const outcome = await runIdeaActions(message.data);
      logInfo("RunIdeaActionsControllerCompleted", { messageId: record.messageId, ...message.data, outcome });
      outcomes.push(outcome);
    } catch (err) {
      logError("RunIdeaActionsControllerFailed", { messageId: record.messageId, ...message.data, error: err instanceof Error ? err.message : err });
      throw err;
    }
  }
  return outcomes;
};
