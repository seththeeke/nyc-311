import { describe, expect, it } from "vitest";
import { SCORECARD_METRICS, StaffMeetingPageSchema, StaffMeetingSchema } from "../../src/models/staffMeeting";
import { memberById } from "../../src/components/team/teamRoster";
import { MOCK_STAFF_MEETINGS } from "../../src/test-data/staffMeetings";

describe("StaffMeetingSchema", () => {
  it("parses every sample meeting, each with the full scorecard in the same order", () => {
    for (const meeting of MOCK_STAFF_MEETINGS) {
      expect(StaffMeetingSchema.parse(meeting)).toEqual(meeting);
      expect(meeting.scorecard.map((entry) => entry.metric)).toEqual([...SCORECARD_METRICS]);
    }
    expect(StaffMeetingPageSchema.parse({ items: MOCK_STAFF_MEETINGS, nextCursor: null }).items).toHaveLength(3);
  });

  it("only names people on the roster", () => {
    for (const meeting of MOCK_STAFF_MEETINGS) {
      const ids = [meeting.notes_by, ...meeting.transcript.map((line) => line.speaker_id), ...meeting.action_items.map((item) => item.owner_id)];
      for (const id of ids) expect(memberById(id)).not.toBeNull();
    }
  });

  it("rejects an unknown action status or metric", () => {
    const [meeting] = MOCK_STAFF_MEETINGS;
    expect(() => StaffMeetingSchema.parse({ ...meeting, action_items: [{ ...meeting.action_items[0], status: "MAYBE" }] })).toThrow();
    expect(() => StaffMeetingSchema.parse({ ...meeting, scorecard: [{ ...meeting.scorecard[0], metric: "VIBES" }] })).toThrow();
  });
});
