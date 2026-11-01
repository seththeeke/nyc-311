import type { ReactElement } from "react";
import type { StaffMeeting } from "../../models/staffMeeting";
import { memberById } from "./teamRoster";

/** The Chief of Staff's write-up: summary, agenda and decisions. */
export function MeetingNotes({ meeting }: { meeting: StaffMeeting }): ReactElement {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-xs font-medium uppercase tracking-wide text-fg-subtle">Summary</h4>
        <p className="mt-1 text-sm leading-relaxed text-fg">{meeting.summary}</p>
        <p className="mt-1 text-[11px] text-fg-subtle">Notes by {memberById(meeting.notes_by)?.name ?? meeting.notes_by}</p>
      </div>
      <div>
        <h4 className="text-xs font-medium uppercase tracking-wide text-fg-subtle">Agenda</h4>
        <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-sm text-fg-muted">
          {meeting.agenda.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </div>
      <div>
        <h4 className="text-xs font-medium uppercase tracking-wide text-fg-subtle">Decisions</h4>
        <ul className="mt-1 space-y-1 text-sm text-fg-muted">
          {meeting.decisions.map((decision) => (
            <li key={decision} className="flex gap-2">
              <span aria-hidden="true" className="text-hue-emerald">
                ✓
              </span>
              <span>{decision}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
