import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** The agent's final report, rendered as markdown. */
export function ReportView({ report }: { report: string }) {
  return (
    <div className="space-y-2 text-sm leading-6 [&_a]:underline [&_code]:text-sky-200 [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold [&_li]:ml-5 [&_ol]:list-decimal [&_ul]:list-disc">
      <Markdown remarkPlugins={[remarkGfm]}>{report}</Markdown>
    </div>
  );
}
