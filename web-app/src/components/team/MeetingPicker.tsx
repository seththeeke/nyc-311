import type { ReactElement } from "react";
import type { StaffMeeting } from "../../models/staffMeeting";
import { meetingDay } from "./teamFormat";

interface MeetingPickerProps {
  meetings: readonly StaffMeeting[];
  selectedId: string;
  onSelect: (meetingId: string) => void;
}

/** One button per published meeting, newest first. */
export function MeetingPicker({ meetings, selectedId, onSelect }: MeetingPickerProps): ReactElement {
  return (
    <div role="group" aria-label="Meetings" className="flex flex-wrap gap-2">
      {meetings.map((meeting, index) => (
        <button
          key={meeting.meeting_id}
          type="button"
          aria-pressed={meeting.meeting_id === selectedId}
          onClick={() => onSelect(meeting.meeting_id)}
          className={`rounded-full border px-3 py-1 text-xs transition-colors ${
            meeting.meeting_id === selectedId ? "border-blue-500/60 bg-blue-600/10 text-fg" : "border-line text-fg-muted hover:bg-panel-hover"
          }`}
        >
          {meetingDay(meeting.held_on)}
          {index === 0 ? " · latest" : ""}
        </button>
      ))}
    </div>
  );
}
