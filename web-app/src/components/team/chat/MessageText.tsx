import type { ReactElement, ReactNode } from "react";
import Markdown, { defaultUrlTransform, type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { CEO_ID } from "../teamRoster";
import { MENTION_HANDLES } from "./chatChannels";

const KNOWN = new Set([...Object.values(MENTION_HANDLES).map((handle) => handle.toLowerCase()), "channel"]);
/* The viewer is the CEO: tags of them, or of everyone, stand out the way Slack highlights your own mentions. */
const ME = new Set([MENTION_HANDLES[CEO_ID].toLowerCase(), "channel"]);
const MENTION_SCHEME = "mention:";

/* `@Rex` becomes a link to mention:Rex, which the `a` renderer draws as a chip. */
function withMentionLinks(text: string): string {
  return text.replace(/(?<![\w@[])@([A-Za-z]+)/g, (whole, handle: string) => (KNOWN.has(handle.toLowerCase()) ? `[${whole}](${MENTION_SCHEME}${handle})` : whole));
}

/*
 * Agents post one field per line ("Median time to resolve: 2.6 days").
 * A short label opening a line becomes bold, so a report reads as fields,
 * not a blob. Lines in tables, lists, code or already bold are left alone.
 */
function withBoldLabels(text: string): string {
  let inCode = false;
  return text
    .split("\n")
    .map((line) => {
      if (line.trimStart().startsWith("```")) inCode = !inCode;
      if (inCode) return line;
      return line.replace(/^([A-Z][A-Za-z0-9 /&'()-]{0,32}):(\s)/, "**$1:**$2");
    })
    .join("\n");
}

function urlTransform(url: string): string {
  return url.startsWith(MENTION_SCHEME) ? url : defaultUrlTransform(url);
}

function MentionOrLink({ href, children }: { href?: string; children?: ReactNode }): ReactElement {
  if (href?.startsWith(MENTION_SCHEME)) {
    const handle = href.slice(MENTION_SCHEME.length);
    const mine = ME.has(handle.toLowerCase());
    return (
      <span data-mention={handle} className={`rounded px-0.5 font-medium ${mine ? "bg-amber-400/25 text-fg" : "bg-indigo-500/15 text-hue-indigo"}`}>
        {children}
      </span>
    );
  }
  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-hue-cyan underline">
      {children}
    </a>
  );
}

const COMPONENTS: Components = {
  a: ({ href, children }) => <MentionOrLink href={href}>{children}</MentionOrLink>,
  p: ({ children }) => <p className="my-1.5 first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="my-1.5 list-disc space-y-0.5 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-1.5 list-decimal space-y-0.5 pl-5">{children}</ol>,
  strong: ({ children }) => <strong className="font-semibold text-fg">{children}</strong>,
  h1: ({ children }) => <p className="my-1.5 font-semibold">{children}</p>,
  h2: ({ children }) => <p className="my-1.5 font-semibold">{children}</p>,
  h3: ({ children }) => <p className="my-1.5 font-semibold">{children}</p>,
  blockquote: ({ children }) => <blockquote className="my-1.5 border-l-2 border-line pl-3 text-fg-muted">{children}</blockquote>,
  code: ({ children }) => <code className="rounded bg-panel-strong px-1 font-mono text-[0.8em]">{children}</code>,
  table: ({ children }) => <table className="my-1 border-collapse text-xs">{children}</table>,
  th: ({ children }) => <th className="border border-line px-2 py-0.5 text-left font-semibold">{children}</th>,
  td: ({ children }) => <td className="border border-line px-2 py-0.5">{children}</td>,
};

/**
 * A message's text: the markdown subset agents post (bold, italics, lists,
 * links, tables, code), never raw HTML, with `@` tags drawn as mention chips.
 */
export function MessageText({ text }: { text: string }): ReactElement {
  return (
    <div className="text-sm leading-relaxed text-fg">
      <Markdown remarkPlugins={[remarkGfm, remarkBreaks]} components={COMPONENTS} urlTransform={urlTransform} skipHtml>
        {withMentionLinks(withBoldLabels(text))}
      </Markdown>
    </div>
  );
}
