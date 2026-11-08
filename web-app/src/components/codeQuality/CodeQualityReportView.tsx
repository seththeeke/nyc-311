import type { ReactElement } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { useCodeQualityReport } from "../../hooks/useCodeQualityReports";
import { formatRun } from "./codeQualityFormat";

const COMPONENTS: Components = {
  h1: ({ children }) => <h3 className="text-xl font-bold text-fg">{children}</h3>,
  h2: ({ children }) => <h4 className="mt-6 text-base font-semibold text-fg">{children}</h4>,
  h3: ({ children }) => <h5 className="mt-4 font-semibold text-fg">{children}</h5>,
  p: ({ children }) => <p className="my-2 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
  strong: ({ children }) => <strong className="font-semibold text-fg">{children}</strong>,
  code: ({ children }) => <code className="rounded bg-panel-strong px-1 font-mono text-[0.85em]">{children}</code>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-hue-cyan underline">
      {children}
    </a>
  ),
  table: ({ children }) => <table className="my-3 border-collapse text-sm">{children}</table>,
  th: ({ children }) => <th className="border border-line px-3 py-1 text-left font-semibold">{children}</th>,
  td: ({ children }) => <td className="border border-line px-3 py-1 tabular-nums">{children}</td>,
};

/** One report in full, rendered from its Markdown (no raw HTML). */
export function CodeQualityReportView({ date, time }: { date: string; time: string }): ReactElement {
  const { data, isPending, isError, error } = useCodeQualityReport(date, time);
  return (
    <section aria-label={`Report for ${formatRun(date, time)}`} className="mt-10 rounded-xl border border-line bg-panel p-6 text-sm text-fg-subtle backdrop-blur">
      {isPending && <p>Loading the report…</p>}
      {isError && <p role="alert">Couldn't load this report: {error.message}</p>}
      {data && (
        <Markdown remarkPlugins={[remarkGfm]} components={COMPONENTS} skipHtml>
          {data.markdown}
        </Markdown>
      )}
    </section>
  );
}
