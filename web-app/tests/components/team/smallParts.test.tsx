import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ActionItemList } from "../../../src/components/team/ActionItemList";
import { MeetingTranscript } from "../../../src/components/team/MeetingTranscript";
import { MeetingNotes } from "../../../src/components/team/MeetingNotes";
import { MeetingScorecard } from "../../../src/components/team/MeetingScorecard";
import { MOCK_STAFF_MEETINGS } from "../../../src/test-data/staffMeetings";

const [latest] = MOCK_STAFF_MEETINGS;

describe("ActionItemList", () => {
  it("says so when there are none", () => {
    render(<ActionItemList items={[]} meetingId="SM-1" />);
    expect(screen.getByText("No action items.")).toBeInTheDocument();
  });

  it("falls back to the raw owner id for someone off the roster", () => {
    render(<ActionItemList items={[{ ...latest.action_items[0], owner_id: "intern" }]} meetingId={latest.meeting_id} />);
    expect(screen.getByText("intern")).toBeInTheDocument();
  });
});

describe("MeetingTranscript", () => {
  it("falls back to the raw speaker id for someone off the roster", () => {
    render(<MeetingTranscript lines={[{ at: "2026-10-31T12:00:00.000Z", speaker_id: "guest", text: "Hello." }]} />);
    expect(screen.getByText("guest")).toBeInTheDocument();
  });
});

describe("MeetingScorecard", () => {
  it("marks an unchanged metric as flat", () => {
    render(<MeetingScorecard entries={[{ ...latest.scorecard[0], previous: null }]} />);
    expect(screen.getByLabelText("same as last meeting")).toHaveTextContent("–");
  });
});

describe("MeetingNotes", () => {
  it("falls back to the raw author id for someone off the roster", () => {
    render(<MeetingNotes meeting={{ ...latest, notes_by: "temp-scribe" }} />);
    expect(screen.getByText("Notes by temp-scribe")).toBeInTheDocument();
  });
});
