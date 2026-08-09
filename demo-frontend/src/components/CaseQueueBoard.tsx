import { useState } from "react";
import { useCase, useCases, useAssignCase, useResolveCase, useCloseCase } from "../lib/queries";
import { CASE_STATUS_COLORS, CASE_STATUS_LABELS, QUEUE_LABELS } from "../lib/theme";
import type { Case, Queue } from "../lib/types";

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}

function StatusBadge({ status }: { status: Case["status"] }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium text-white"
      style={{ background: CASE_STATUS_COLORS[status] }}
    >
      {CASE_STATUS_LABELS[status]}
    </span>
  );
}

function CaseCard({ c, interactive }: { c: Case; interactive: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const { data: detail } = useCase(expanded ? c.case_id : "");
  const assign = useAssignCase();
  const resolve = useResolveCase();
  const close = useCloseCase();

  const slaBreached = new Date(c.sla_deadline).getTime() < Date.now() && !["resolved_by_admin", "closed", "auto_resolved"].includes(c.status);

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-mono text-xs text-[var(--color-ink-muted)]">{c.case_id}</div>
          <div className="mt-0.5 text-sm font-medium text-[var(--color-ink)]">{c.case_type.replaceAll("_", " ")}</div>
        </div>
        <StatusBadge status={c.status} />
      </div>

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--color-ink-soft)]">
        <span>Opened {timeAgo(c.created_at)}</span>
        {c.order_id && <span>&middot; {c.order_id}</span>}
        {c.assigned_owner && <span>&middot; assigned</span>}
        {slaBreached && <span className="font-medium" style={{ color: "var(--color-critical)" }}>&middot; SLA breached</span>}
      </div>

      <button onClick={() => setExpanded((v) => !v)} className="mt-2 text-xs font-medium text-[var(--color-brand-500)] hover:underline">
        {expanded ? "Hide investigation log" : "View investigation log"}
      </button>

      {expanded && (
        <div className="mt-2 space-y-1.5 border-t border-[var(--color-border-soft)] pt-2">
          {(detail?.events ?? []).map((e) => (
            <div key={e.sequence_number} className="text-xs">
              <span className="font-medium text-[var(--color-ink)]">{e.event_type}</span>{" "}
              <span className="text-[var(--color-ink-muted)]">({e.actor}, {timeAgo(e.occurred_at)})</span>
              {typeof e.payload?.reasoning === "string" && (
                <div className="mt-0.5 rounded bg-[var(--color-paper)] p-1.5 text-[var(--color-ink-soft)]">{e.payload.reasoning as string}</div>
              )}
              {typeof e.payload?.confidence === "number" && (
                <div className="text-[var(--color-ink-muted)]">confidence: {Math.round((e.payload.confidence as number) * 100)}%</div>
              )}
            </div>
          ))}
        </div>
      )}

      {interactive && !["resolved_by_admin", "closed"].includes(c.status) && (
        <div className="mt-2 flex gap-2 border-t border-[var(--color-border-soft)] pt-2">
          {!c.assigned_owner && (
            <button
              onClick={() => assign.mutate(c.case_id)}
              disabled={assign.isPending}
              className="rounded border border-[var(--color-border)] px-2 py-1 text-xs font-medium hover:bg-[var(--color-paper)]"
            >
              Assign to me
            </button>
          )}
          <button
            onClick={() => resolve.mutate({ id: c.case_id })}
            disabled={resolve.isPending}
            className="rounded bg-[var(--color-brand-500)] px-2 py-1 text-xs font-medium text-white hover:bg-[var(--color-brand-600)]"
          >
            Resolve
          </button>
          <button
            onClick={() => close.mutate(c.case_id)}
            disabled={close.isPending}
            className="rounded border border-[var(--color-border)] px-2 py-1 text-xs font-medium hover:bg-[var(--color-paper)]"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}

function QueueColumn({ queue, cases, interactive }: { queue: Queue; cases: Case[]; interactive: boolean }) {
  return (
    <div className="flex-1 min-w-[280px]">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--color-ink)]">{QUEUE_LABELS[queue]}</h3>
        <span className="rounded-full bg-[var(--color-border-soft)] px-2 py-0.5 text-xs font-medium text-[var(--color-ink-soft)]">{cases.length}</span>
      </div>
      <div className="flex flex-col gap-2">
        {cases.length === 0 && <div className="text-xs text-[var(--color-ink-muted)]">No open cases.</div>}
        {cases.map((c) => (
          <CaseCard key={c.case_id} c={c} interactive={interactive} />
        ))}
      </div>
    </div>
  );
}

export function CaseQueueBoard({ interactive }: { interactive: boolean }) {
  const { data: cases, isLoading } = useCases();
  if (isLoading || !cases) return <div className="text-sm text-[var(--color-ink-muted)]">Loading case queues&hellip;</div>;

  const systemFailure = cases.filter((c) => c.queue === "system-failure");
  const capacityEscalation = cases.filter((c) => c.queue === "capacity-escalation");

  return (
    <div className="flex flex-col gap-4 md:flex-row">
      <QueueColumn queue="system-failure" cases={systemFailure} interactive={interactive} />
      <QueueColumn queue="capacity-escalation" cases={capacityEscalation} interactive={interactive} />
    </div>
  );
}
