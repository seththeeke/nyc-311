import { FeatureRequestDraftSchema, FeatureRequestSchema, SearchRequestsResponseSchema } from "../../models/boroughSimPublicApi";
import type { ActionType, ResidentCurrent } from "../../models/resident";
import type { ResidentFeatureRequestThread, ResidentIdea, StepExecution, ThreadWrite } from "../../models/residentIdea";
import type { PublicApiReply, PublicApiRequest } from "./publicApiClient";

/*
 * The residents' tools (docs/16-resident-action-models.md §5.1): fixed
 * recipes over BoroughSim's public API. The model only picks a tool and,
 * where it must, supplies words; everything that can come from data does,
 * and anything the model supplies is checked before a call is made.
 */

/* A stored response body is cut to this many characters (docs/16 §5.3). */
export const MAX_STORED_BODY_CHARS = 4096;

export interface ToolContext {
  resident: ResidentCurrent;
  idea: ResidentIdea;
  /* The feature requests this resident has filed, from their thread rows. */
  featureRequests: ResidentFeatureRequestThread[];
  /* This step's sequence number. */
  sequence: number;
  now: () => Date;
  call: (request: PublicApiRequest) => Promise<PublicApiReply>;
}

export interface ToolOutcome {
  execution: StepExecution;
  threadWrites: ThreadWrite[];
}

export interface ActionTool {
  name: ActionType;
  /* Calls allowed per idea; a capped tool is no longer offered. */
  maxPerIdea: number;
  description: string;
  /* JSON Schema for the model's input. */
  inputSchema: (context: ToolContext) => Record<string, unknown>;
  /* Offered only when it can run. */
  runnable: (context: ToolContext) => boolean;
  run: (context: ToolContext, input: Record<string, unknown>) => Promise<ToolOutcome>;
}

/* Keeps a stored body small: an oversized body is replaced by its first characters. */
export function truncateBody(body: unknown): unknown {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return text.length > MAX_STORED_BODY_CHARS ? { truncated: true, text: text.slice(0, MAX_STORED_BODY_CHARS) } : body;
}

/* An HTTP error in plain words: its status and BoroughSim's own error code and message, when it sent them. */
function describeHttpError(reply: PublicApiReply): string {
  const error = (reply.body as { error?: { code?: unknown; message?: unknown } } | null)?.error;
  const detail = error && typeof error.code === "string" ? ` ${error.code}: ${String(error.message)}` : "";
  return `BoroughSim answered ${reply.status_code}${detail}`;
}

function requester(context: ToolContext): Record<string, string> {
  return { "X-Requester": `resident:${context.resident.persona_id}` };
}

/* Runs one call and shapes the step's execution; a network failure is a FAILED step, not a thrown error. */
async function execute(
  context: ToolContext,
  request: PublicApiRequest,
  interpret: (reply: PublicApiReply) => { ok: boolean; summary: string; threadWrites: ThreadWrite[] }
): Promise<ToolOutcome> {
  const startedAt = context.now().toISOString();
  const stored = { method: request.method, path: request.path, ...(request.body !== undefined ? { body: request.body } : {}) };
  try {
    const reply = await context.call(request);
    const result = interpret(reply);
    return {
      execution: {
        status: result.ok ? "COMPLETED" : "FAILED",
        summary: result.summary,
        request: stored,
        response: { status_code: reply.status_code, call_id: reply.call_id, body: truncateBody(reply.body) },
        error: result.ok ? null : result.summary,
        started_at: startedAt,
        completed_at: context.now().toISOString(),
      },
      threadWrites: result.ok ? result.threadWrites : [],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      execution: {
        status: "FAILED",
        summary: `Couldn't reach BoroughSim: ${message}`,
        request: stored,
        response: null,
        error: message,
        started_at: startedAt,
        completed_at: context.now().toISOString(),
      },
      threadWrites: [],
    };
  }
}

/* A check that fails before any call: recorded FAILED with no request or response. */
function rejected(context: ToolContext, summary: string): ToolOutcome {
  const at = context.now().toISOString();
  return {
    execution: { status: "FAILED", summary, request: null, response: null, error: summary, started_at: at, completed_at: at },
    threadWrites: [],
  };
}

function humanStatus(status: string): string {
  return status.toLowerCase().replace(/_/g, " ");
}

const searchRequests: ActionTool = {
  name: "SEARCH_REQUESTS",
  maxPerIdea: 3,
  description: "Look up the repair your idea is about on BoroughSim and see where it stands. Takes no input: it searches for your idea's own order.",
  inputSchema: () => ({ type: "object", properties: {} }),
  runnable: (context) => context.idea.order_id !== null,
  run: async (context) => {
    const orderId = context.idea.order_id as string;
    return execute(context, { method: "POST", path: "/v1/requests/search", body: { search_params: { order_id: orderId } }, headers: requester(context) }, (reply) => {
      const parsed = SearchRequestsResponseSchema.safeParse(reply.body);
      if (reply.status_code !== 200 || !parsed.success) return { ok: false, summary: describeHttpError(reply), threadWrites: [] };
      const [item] = parsed.data.items;
      if (!item) return { ok: true, summary: `BoroughSim has no request for order ${orderId}.`, threadWrites: [] };
      const window = item.scheduled_window ? `, scheduled ${item.scheduled_window.start} to ${item.scheduled_window.end}` : "";
      const reason = item.status_reason_description ? ` (${item.status_reason_description})` : "";
      return {
        ok: true,
        summary: `Found it: ${humanStatus(item.status)}${window}${reason}.`,
        threadWrites: [{ kind: "ORDER_CHECKED", order_id: orderId, status: item.status, scheduled_window: item.scheduled_window, at: context.now().toISOString() }],
      };
    });
  },
};

const createFeatureRequest: ActionTool = {
  name: "CREATE_FEATURE_REQUEST",
  maxPerIdea: 1,
  description: "Ask BoroughSim for something it does not do yet. You write the title and the description in your own words.",
  inputSchema: () => ({
    type: "object",
    properties: {
      title: { type: "string", description: "A short title, 5 to 120 characters." },
      description: { type: "string", description: "What you want and why, 10 to 2000 characters." },
    },
    required: ["title", "description"],
  }),
  runnable: () => true,
  run: async (context, input) => {
    const draft = FeatureRequestDraftSchema.safeParse(input);
    if (!draft.success) return rejected(context, `Not filed: ${draft.error.issues.map((issue) => `${issue.path.join(".")} ${issue.message}`).join("; ")}`);
    const body = { title: draft.data.title, description: draft.data.description, submitted_by: { name: context.resident.name, email: null } };
    const headers = { ...requester(context), "Idempotency-Key": `${context.idea.idea_id}-${context.sequence}` };
    return execute(context, { method: "POST", path: "/v1/feature-requests", body, headers }, (reply) => {
      const parsed = FeatureRequestSchema.safeParse(reply.body);
      if (reply.status_code !== 201 || !parsed.success) return { ok: false, summary: describeHttpError(reply), threadWrites: [] };
      const filed = parsed.data;
      return {
        ok: true,
        summary: `Filed feature request ${filed.feature_request_id}: "${filed.title}" (${humanStatus(filed.status)}).`,
        threadWrites: [
          {
            kind: "FEATURE_REQUEST_FILED",
            feature_request_id: filed.feature_request_id,
            title: filed.title,
            idea_id: context.idea.idea_id,
            status: filed.status,
            status_reason: filed.status_reason_description,
            at: context.now().toISOString(),
          },
        ],
      };
    });
  },
};

const getFeatureRequest: ActionTool = {
  name: "GET_FEATURE_REQUEST",
  maxPerIdea: 2,
  description: "Check on a feature request you filed before.",
  inputSchema: (context) => ({
    type: "object",
    properties: {
      feature_request_id: {
        type: "string",
        enum: context.featureRequests.map((thread) => thread.feature_request_id),
        description: "One of the feature requests you filed.",
      },
    },
    required: ["feature_request_id"],
  }),
  runnable: (context) => context.featureRequests.length > 0,
  run: async (context, input) => {
    const id = typeof input.feature_request_id === "string" ? input.feature_request_id : "";
    if (!context.featureRequests.some((thread) => thread.feature_request_id === id)) {
      return rejected(context, `Not checked: ${id || "no id"} is not a feature request you filed.`);
    }
    return execute(context, { method: "GET", path: `/v1/feature-requests/${id}`, headers: requester(context) }, (reply) => {
      const parsed = FeatureRequestSchema.safeParse(reply.body);
      if (reply.status_code !== 200 || !parsed.success) return { ok: false, summary: describeHttpError(reply), threadWrites: [] };
      const reason = parsed.data.status_reason_description ? `: ${parsed.data.status_reason_description}` : "";
      return {
        ok: true,
        summary: `Feature request ${id} is ${humanStatus(parsed.data.status)}${reason}.`,
        threadWrites: [
          {
            kind: "FEATURE_REQUEST_CHECKED",
            feature_request_id: id,
            status: parsed.data.status,
            status_reason: parsed.data.status_reason_description,
            at: context.now().toISOString(),
          },
        ],
      };
    });
  },
};

/* Every tool with a recipe. BROWSE_WEBSITE has none until RPA exists, so it is never offered. */
export const ACTION_TOOLS: Partial<Record<ActionType, ActionTool>> = {
  SEARCH_REQUESTS: searchRequests,
  CREATE_FEATURE_REQUEST: createFeatureRequest,
  GET_FEATURE_REQUEST: getFeatureRequest,
};
