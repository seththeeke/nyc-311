import type { ReactElement } from "react";
import { HEADLINE_LINES } from "./marketingContent";

const WORD_DELAY_MS = 90;
const LINE_PAUSE_MS = 260;

/*
 * The hero headline, word by word: each word rises out of a blur on its own
 * delay, and the last line's words wear the shimmering gradient. The full sentence
 * stays in the heading's accessible name.
 */
export function KineticHeadline(): ReactElement {
  let index = 0;
  return (
    <h1
      aria-label={HEADLINE_LINES.map((line) => line.join(" ")).join(" ")}
      className="text-5xl font-black leading-[0.95] tracking-tight text-fg sm:text-7xl lg:text-8xl"
    >
      {HEADLINE_LINES.map((line, lineIndex) => (
        <span key={line.join(" ")} aria-hidden="true" className="block">
          {line.map((word) => {
            const delay = index * WORD_DELAY_MS + lineIndex * LINE_PAUSE_MS;
            index += 1;
            return (
              <span
                key={word}
                className="mr-[0.25em] inline-block animate-[mk-rise_0.9s_cubic-bezier(0.2,0.8,0.2,1)_both]"
                style={{ animationDelay: `${delay}ms` }}
              >
                {/* Clip-text can't paint through the animated word, so the gradient sits on an inner span. */}
                <span className={lineIndex === HEADLINE_LINES.length - 1 ? "mk-gradient-text" : undefined}>{word}</span>
              </span>
            );
          })}
        </span>
      ))}
    </h1>
  );
}
