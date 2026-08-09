import { useState } from "react";
import { Link } from "react-router-dom";
import { IncidentMap } from "../components/IncidentMap";
import { StatTile } from "../components/StatTile";
import { BarChart, SplitBar } from "../components/BarChart";
import { useMetrics, useShifts } from "../lib/queries";
import { agencyColor, boroughColor } from "../lib/theme";

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path d="m18 15-6-6-6 6" />
    </svg>
  );
}

export function HomePage() {
  const { data: m } = useMetrics();
  const { data: shifts } = useShifts();
  const [panelOpen, setPanelOpen] = useState(true);

  return (
    <div className="relative h-[100svh] w-full overflow-hidden">
      <IncidentMap variant="immersive" />

      {/* top-left: headline + stat strip, floating over the map */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[400] flex flex-col items-start gap-3 p-4 pt-20 sm:p-6 sm:pt-24">
        <div className="pointer-events-auto max-w-md rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] p-4 backdrop-blur-md">
          <h1 className="text-lg font-semibold text-[var(--color-glass-ink)]">Live Operations</h1>
          <p className="mt-1 text-sm leading-relaxed text-[var(--color-glass-ink-soft)]">
            Real NYC 311 incidents moving through a simulated dispatch workflow, with crews responding live.{" "}
            <Link to="/about" className="font-medium text-white underline underline-offset-2 hover:no-underline">
              What am I looking at?
            </Link>
          </p>
        </div>

        {m && (
          <div className="pointer-events-auto grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <StatTile variant="glass" label="Open Incidents" value={String(m.open_incidents)} sublabel="Orders in flight" />
            <StatTile variant="glass" label="Operators on Duty" value={String(m.operators_on_duty)} sublabel={`of ${m.active_operators} active`} />
            <StatTile variant="glass" label="Active Shifts" value={String(m.active_shifts)} sublabel={`of ${m.total_shifts} total`} />
            <StatTile
              variant="glass"
              label="Auto-Resolve Rate"
              value={`${Math.round(m.auto_resolve_rate * 100)}%`}
              sublabel="of decided cases"
              accent="var(--color-good)"
            />
          </div>
        )}
      </div>

      {/* right: collapsible insights panel */}
      <div
        className={`pointer-events-none absolute inset-y-0 right-0 z-[400] flex items-start p-3 pt-20 transition-transform duration-300 sm:p-4 sm:pt-24 ${
          panelOpen ? "" : "translate-x-[calc(100%-2.75rem)]"
        }`}
      >
        <div className="pointer-events-auto flex max-h-[calc(100svh-6.5rem)] w-[336px] max-w-[85vw] flex-col overflow-hidden rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-glass-bg-strong)] shadow-2xl backdrop-blur-md">
          <button
            onClick={() => setPanelOpen((v) => !v)}
            className="flex shrink-0 items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-[var(--color-glass-ink)]"
          >
            Insights
            <ChevronIcon open={!panelOpen} />
          </button>

          {m && (
            <div className="flex flex-col gap-5 overflow-y-auto px-4 pb-5">
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-glass-ink-muted)]">Orders by Stage</h3>
                <BarChart
                  dark
                  data={[
                    { label: "Ingest", value: m.order_volume_by_stage.Ingest, color: "var(--color-cat-1-dark)" },
                    { label: "Schedule", value: m.order_volume_by_stage.Schedule, color: "var(--color-cat-1-dark)" },
                    { label: "Execute", value: m.order_volume_by_stage.Execute, color: "var(--color-cat-1-dark)" },
                    { label: "Resolve", value: m.order_volume_by_stage.Resolve, color: "var(--color-cat-1-dark)" },
                  ]}
                />
              </div>

              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-glass-ink-muted)]">Incidents by Borough</h3>
                <BarChart dark data={Object.entries(m.orders_by_borough).map(([b, v]) => ({ label: b, value: v, color: boroughColor(b, "dark") }))} />
              </div>

              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-glass-ink-muted)]">Requests by Complaint Type</h3>
                <BarChart
                  dark
                  data={Object.entries(m.requests_by_complaint_type).map(([c, v]) => ({ label: c, value: v, color: "var(--color-cat-3-dark)" }))}
                />
              </div>

              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-glass-ink-muted)]">Case Outcomes</h3>
                <SplitBar
                  dark
                  segments={[
                    { label: "Auto-resolved", value: Math.round(m.auto_resolve_rate * 100), color: "var(--color-good)" },
                    { label: "Escalated", value: Math.round(m.escalation_rate * 100), color: "var(--color-warning)" },
                  ]}
                />
              </div>

              {shifts && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-glass-ink-muted)]">Resources on the Board</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {shifts.map((s) => {
                      const [agency] = s.pool.split("#");
                      return (
                        <span
                          key={s.shift_id}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-glass-border)] px-2 py-1 text-[11px] text-[var(--color-glass-ink-soft)]"
                        >
                          <span className="inline-block h-2 w-2 rounded-full" style={{ background: agencyColor(agency, "dark") }} />
                          {s.pool.replace("#", " – ")}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
