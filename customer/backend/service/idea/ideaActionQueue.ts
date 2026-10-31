import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { requireEnv } from "../../env";
import { logInfo } from "../../logger";
import type { IdeaActionMessage } from "../../models/ideaActionMessage";

export interface IdeaActionQueueDeps {
  client?: SQSClient;
  queueUrl?: string;
}

/** Hands a new idea to the action worker (docs/16 §5.2), the only link between the two halves. */
export async function enqueueIdeaAction(message: IdeaActionMessage, deps: IdeaActionQueueDeps = {}): Promise<void> {
  const client = deps.client ?? new SQSClient({});
  const queueUrl = deps.queueUrl ?? requireEnv("IDEA_ACTIONS_QUEUE_URL");
  await client.send(new SendMessageCommand({ QueueUrl: queueUrl, MessageBody: JSON.stringify(message) }));
  logInfo("IdeaActionEnqueued", { ...message, queueUrl });
}
