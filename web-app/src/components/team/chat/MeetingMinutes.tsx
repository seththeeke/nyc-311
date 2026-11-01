import type { ReactElement } from "react";
import type { StaffMeeting } from "../../../models/staffMeeting";
import { ActionItemList } from "../ActionItemList";
import { MeetingNotes } from "../MeetingNotes";
import { MeetingScorecard } from "../MeetingScorecard";
import { meetingDay, minutesBetween } from "../teamFormat";

/** The Staff Meeting minutes as a card attached to the Chief of Staff's post (#146). */
export function MeetingMinutes({ meeting }: { meeting: StaffMeeting }): ReactElement {
  return (
    <div className="mt-2 rounded-lg border border-line border-l-4 border-l-violet-400/70 bg-panel p-3">
      <p className="text-sm font-semibold text-fg">Staff Meeting minutes · {meetingDay(meeting.held_on)}</p>
      <p className="text-xs text-fg-subtle">
        {minutesBetween(meeting.started_at, meeting.ended_at)} min · WBR for the week of {meetingDay(meeting.wbr_week)}
      </p>
      <div className="mt-3">
        <MeetingNotes meeting={meeting} />
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-medium text-hue-cyan">Scorecard and action items</summary>
        <div className="mt-3 space-y-4">
          <MeetingScorecard entries={meeting.scorecard} />
          <ActionItemList items={meeting.action_items} meetingId={meeting.meeting_id} />
        </div>
      </details>
    </div>
  );
}
