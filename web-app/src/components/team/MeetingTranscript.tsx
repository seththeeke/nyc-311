import type { ReactElement } from "react";
import type { TranscriptLine } from "../../models/staffMeeting";
import { PersonaAvatar } from "../residents/PersonaAvatar";
import { ROLE_ACCENT, clockTime } from "./teamFormat";
import { memberById } from "./teamRoster";

/** The meeting as it happened: one chat line per turn, each speaker in their role's colour. */
export function MeetingTranscript({ lines }: { lines: readonly TranscriptLine[] }): ReactElement {
  return (
    <ol role="log" aria-label="Transcript" className="space-y-2">
      {lines.map((line, index) => {
        const speaker = memberById(line.speaker_id);
        const name = speaker?.name ?? line.speaker_id;
        return (
          <li key={`${line.at}-${index}`} className="flex gap-3">
            <PersonaAvatar name={name} modelKey={speaker?.model_key ?? null} />
            <div className={`min-w-0 flex-1 rounded-xl border-l-4 bg-panel px-3 py-2 ${ROLE_ACCENT[speaker?.role ?? "ENGINEER"]}`}>
              <p className="flex items-baseline justify-between gap-2 text-xs">
                <span className="font-semibold text-fg">{name}</span>
                <time dateTime={line.at} className="text-fg-subtle">
                  {clockTime(line.at)}
                </time>
              </p>
              <p className="mt-0.5 text-sm leading-relaxed text-fg-muted">{line.text}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
