import { useState, type ReactElement } from "react";
import { Link } from "react-router-dom";
import { useCodeQualityReports } from "../../hooks/useCodeQualityReports";
import { CodeQualityHistory } from "../codeQuality/CodeQualityHistory";
import { CodeQualityReportView } from "../codeQuality/CodeQualityReportView";
import { CodeQualityScores } from "../codeQuality/CodeQualityScores";
import { reportId } from "../codeQuality/codeQualityFormat";
import { PAGE_CONTENT_CLASSES } from "../pageLayout";

/**
 * Monitoring → Code Quality (docs/17-executive-team.md §19.6): the
 * Software Analyzer's audits, one package per report. The latest score per
 * package, every report as a table, and the chosen report in full (the
 * newest until another is picked).
 */
export function CodeQualityPage(): ReactElement {
  const { data: reports, isPending, isError, error } = useCodeQualityReports();
  const [chosen, setChosen] = useState<string | undefined>(undefined);
  const selectedId = chosen ?? (reports?.[0] ? reportId(reports[0]) : undefined);
  const [date, time] = selectedId?.split("/") ?? [];

  return (
    <div className="relative min-h-full overflow-hidden bg-surface">
      <div aria-hidden="true" className="theme-aurora pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-aurora-1 absolute -top-40 -right-16 h-[26rem] w-[26rem] rounded-full bg-violet-600/20 blur-3xl" />
        <div className="animate-aurora-3 absolute -bottom-32 -left-24 h-[22rem] w-[22rem] rounded-full bg-indigo-600/15 blur-3xl" />
      </div>

      <main className={PAGE_CONTENT_CLASSES}>
        <Link to="/monitoring" className="text-sm font-medium text-fg-muted transition-colors hover:text-fg">
          &larr; Monitoring
        </Link>
        <h1 className="mt-4 bg-gradient-to-r from-hue-violet via-hue-indigo to-hue-cyan bg-clip-text text-3xl font-black tracking-tight text-transparent sm:text-4xl">
          Code Quality
        </h1>
        <p className="mt-3 max-w-2xl text-fg-subtle">
          An outside auditor scores one part of the codebase at a time, out of 100, for complexity, consistency, duplication, code smells and how easily an AI agent can work in it.
        </p>

        {isPending && <p className="mt-8 text-fg-subtle">Loading reports…</p>}
        {isError && (
          <p role="alert" className="mt-8 text-fg-subtle">
            Couldn't load the reports: {error.message}
          </p>
        )}
        {reports && reports.length === 0 && <p className="mt-8 text-fg-subtle">No reports yet. The first audit will appear here.</p>}
        {reports && reports.length > 0 && (
          <>
            <CodeQualityScores reports={reports} />
            <CodeQualityHistory reports={reports} selectedId={selectedId} onSelect={setChosen} />
            {date && time && <CodeQualityReportView key={selectedId} date={date} time={time} />}
          </>
        )}
      </main>
    </div>
  );
}
