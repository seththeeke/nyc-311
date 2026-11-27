import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import { logInfo, logWarn } from "../../logger";
import { requireEnv } from "../../env";
import { DispatchDecisionSchema, type DispatchDecision } from "../../models/dispatchDecision";

export interface RecordDispatchDecisionDeps {
  snsClient?: SNSClient;
  topicArn?: string;
}

/**
 * One dispatch_decisions row (20-ml-driver-assignment.md §2.4): logged as
 * `DispatchDecision`, then published to the decisions topic, which a
 * warehouse Firehose lands. Best-effort: a failed publish is a WARN and
 * never fails the dispatch it describes, since the vehicle is already
 * claimed and the Order already scheduled.
 */
export async function recordDispatchDecision(decision: DispatchDecision, deps: RecordDispatchDecisionDeps = {}): Promise<void> {
  logInfo("DispatchDecision", { ...decision });
  try {
    const validated = DispatchDecisionSchema.parse(decision);
    const snsClient = deps.snsClient ?? new SNSClient({});
    const topicArn = deps.topicArn ?? requireEnv("DISPATCH_DECISIONS_TOPIC_ARN");
    await snsClient.send(new PublishCommand({ TopicArn: topicArn, Message: JSON.stringify(validated) }));
    logInfo("DispatchDecisionPublished", { plannerRunId: decision.planner_run_id, orderId: decision.order_id });
  } catch (err) {
    logWarn("DispatchDecisionPublishFailed", {
      plannerRunId: decision.planner_run_id,
      orderId: decision.order_id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
