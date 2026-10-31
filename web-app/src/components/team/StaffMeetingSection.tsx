import type { ReactElement } from "react";
import { useStaffMeetings } from "../../hooks/useStaffMeetings";
import { useTeamSelection } from "../../hooks/useTeamSelection";
import { ActionItemList } from "./ActionItemList";
import { MeetingNotes } from "./MeetingNotes";
import { MeetingPicker } from "./MeetingPicker";
import { MeetingScorecard } from "./MeetingScorecard";
import { MeetingTranscript } from "./MeetingTranscript";
import { meetingDay, minutesBetween } from "./teamFormat";

/**
 * The daily Staff Meeting (#146): the team meets on the Mac mini, the
 * Chief of Staff publishes the notes, and every meeting reviews the same
 * scorecard and the action items still open.
 */
export function StaffMeetingSection(): ReactElement {
  const { data: meetings, isLoading, error } = useStaffMeetings();
  const { meetingId, selectMeeting } = useTeamSelection();
  const meeting = meetings?.find((candidate) => candidate.meeting_id === meetingId) ?? meetings?.[0] ?? null;

  return (
    <section aria-labelledby="staff-meeting-heading" className="mt-10">
      <h2 id="staff-meeting-heading" className="text-xl font-semibold text-fg">
        Staff Meeting
      </h2>
      <p className="mt-1 text-sm text-fg-muted">Every morning the team reviews the WBR, argues out the day&apos;s issues and leaves with owned, dated action items.</p>
      {isLoading && (
        <p role="status" className="mt-4 text-sm text-fg-muted">
          Loading meetings…
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-danger-soft p-2 text-sm text-danger">
          Couldn&apos;t load meetings: {error.message}
        </p>
      )}
      {meetings?.length === 0 && <p className="mt-4 text-sm text-fg-muted">No meetings yet.</p>}
      {meetings && meeting && (
        <div className="mt-4 space-y-4">
          <MeetingPicker meetings={meetings} selectedId={meeting.meeting_id} onSelect={selectMeeting} />
          <p className="text-xs text-fg-subtle">
            {meetingDay(meeting.held_on)} · {minutesBetween(meeting.started_at, meeting.ended_at)} min · reviewed the WBR for the week of{" "}
            {meetingDay(meeting.wbr_week)}
          </p>
          <MeetingScorecard entries={meeting.scorecard} />
          <div className="grid gap-6 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <h3 className="mb-2 text-sm font-semibold text-fg">Transcript</h3>
              <MeetingTranscript lines={meeting.transcript} />
            </div>
            <div className="space-y-6 lg:col-span-2">
              <div>
                <h3 className="mb-2 text-sm font-semibold text-fg">Notes</h3>
                <MeetingNotes meeting={meeting} />
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold text-fg">Action items</h3>
                <ActionItemList items={meeting.action_items} meetingId={meeting.meeting_id} />
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
