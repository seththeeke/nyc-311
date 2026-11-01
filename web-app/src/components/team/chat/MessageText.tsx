import type { ReactElement } from "react";
import { CEO_ID } from "../teamRoster";
import { MENTION_HANDLES } from "./chatChannels";

const KNOWN = new Set([...Object.values(MENTION_HANDLES), "channel"]);
/* The viewer is the CEO: tags of them, or of everyone, stand out the way Slack highlights your own mentions. */
const ME = new Set([MENTION_HANDLES[CEO_ID], "channel"]);

/** A message's text with its `@` tags drawn as mention chips. */
export function MessageText({ text }: { text: string }): ReactElement {
  return (
    <p className="text-sm leading-relaxed text-fg">
      {text.split(/(@\w+)/).map((part, i) => {
        const handle = part.slice(1);
        if (!part.startsWith("@") || !KNOWN.has(handle)) return part;
        return (
          <span key={i} data-mention={handle} className={`rounded px-0.5 font-medium ${ME.has(handle) ? "bg-amber-400/25 text-fg" : "bg-indigo-500/15 text-hue-indigo"}`}>
            {part}
          </span>
        );
      })}
    </p>
  );
}
