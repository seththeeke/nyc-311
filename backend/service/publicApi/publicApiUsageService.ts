import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import { logInfo } from "../../logger";
import { requireEnv } from "../../env";
import type { PublicApiCall } from "../../models/publicApi/publicApiCall";

export interface RecordPublicApiCallDeps {
  snsClient?: SNSClient;
  topicArn?: string;
}

/**
 * One `public_api_calls` row (16-resident-action-models.md §4): logged as
 * the `PublicApiCall` line, then published to the usage topic, which
 * Firehose lands in the warehouse. Throws on a failed publish; the router
 * treats that as best-effort.
 */
export async function recordPublicApiCall(call: PublicApiCall, deps: RecordPublicApiCallDeps = {}): Promise<void> {
  logInfo("PublicApiCall", { ...call });
  const snsClient = deps.snsClient ?? new SNSClient({});
  const topicArn = deps.topicArn ?? requireEnv("PUBLIC_API_CALLS_TOPIC_ARN");
  await snsClient.send(new PublishCommand({ TopicArn: topicArn, Message: JSON.stringify(call) }));
  logInfo("PublicApiCallPublished", { callId: call.call_id, topicArn });
}
