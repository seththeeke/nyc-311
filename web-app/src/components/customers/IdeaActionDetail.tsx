import type { ReactElement } from "react";
import type { IdeaAction } from "../../models/customerIdea";
import { ACTION_TYPE_LABELS } from "./customerFormat";
import { RecordingPlayer } from "./RecordingPlayer";

function ActionBody({ action }: { action: IdeaAction }): ReactElement {
  switch (action.type) {
    case "BROWSE_WEBSITE":
      return <RecordingPlayer recording={action.recording} />;
    case "CHECK_STATUS_API":
      return (
        <div className="space-y-2 font-mono text-xs">
          <p className="text-fg-muted">
            {action.request.method} {action.request.url}
          </p>
          <p className="text-fg-subtle">HTTP {action.response.status_code}</p>
          <pre className="overflow-x-auto rounded-lg bg-panel-sunken p-3 text-fg-muted">{action.response.body}</pre>
        </div>
      );
    case "REQUEST_FEATURE":
      return (
        <div className="rounded-lg bg-panel-sunken p-3 text-sm">
          <p className="font-medium text-fg">{action.feature_request.title}</p>
          <p className="mt-1 text-fg-muted">{action.feature_request.description}</p>
          <p className="mt-2 text-xs text-fg-subtle">{action.feature_request.reference_id ?? "Not yet accepted by intake"}</p>
        </div>
      );
  }
}

/**
 * "What they did" on the Idea Detail view: the action the resident's
 * personality led to, in words, then its evidence — the RPA recording, the
 * API exchange, or the feature request filed.
 */
export function IdeaActionDetail({ action }: { action: IdeaAction | null }): ReactElement {
  return (
    <section aria-label="What they did" className="mt-4 rounded-xl border border-line bg-panel p-4">
      <h2 className="text-sm font-semibold text-fg">What they did</h2>
      {action ? (
        <>
          <p className="mt-2 text-sm text-fg">
            {ACTION_TYPE_LABELS[action.type]}
            {action.status === "FAILED" && <span className="text-fg-muted"> — it didn&apos;t work</span>}
          </p>
          <p className="mt-1 text-sm text-fg-muted">{action.summary}</p>
          {action.outcome && <p className="mt-1 text-sm text-fg-muted">{action.outcome}</p>}
          <p className="mt-1 text-xs text-fg-subtle">{new Date(action.started_at).toLocaleString()}</p>
          <div className="mt-3">
            <ActionBody action={action} />
          </div>
        </>
      ) : (
        <p className="mt-2 text-sm text-fg-muted">
          Nothing yet. For now ideas are recorded but not acted on; requesting a feature will be the first thing residents can do.
        </p>
      )}
    </section>
  );
}
