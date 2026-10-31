import { config } from "../config";
import { StaffMeetingPageSchema, type StaffMeetingPage } from "../models/staffMeeting";
import { MOCK_STAFF_MEETINGS } from "../test-data/staffMeetings";

/*
 * The executive team's published Staff Meeting notes (#146), newest
 * first. Where the notes are posted is still open, so the live route is
 * the contract this mock settles: `GET /team/staff-meetings`.
 */
export interface StaffMeetingService {
  listMeetings(): Promise<StaffMeetingPage>;
}

class LiveStaffMeetingService implements StaffMeetingService {
  async listMeetings(): Promise<StaffMeetingPage> {
    const response = await fetch(`${config.apiBaseUrl}/team/staff-meetings`);
    if (!response.ok) throw new Error(`GET /team/staff-meetings failed: HTTP ${response.status}`);
    return StaffMeetingPageSchema.parse(await response.json());
  }
}

/* Long enough to see the loading state while iterating on the page. */
const MOCK_LATENCY_MS = 250;

class MockStaffMeetingService implements StaffMeetingService {
  async listMeetings(): Promise<StaffMeetingPage> {
    await new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS));
    const items = [...MOCK_STAFF_MEETINGS].sort((a, b) => b.held_on.localeCompare(a.held_on));
    return { items: items.map((meeting) => ({ ...meeting })), nextCursor: null };
  }
}

/*
 * VITE_TEAM_DATA_MODE overrides VITE_DATA_MODE for this service only, as
 * VITE_RESIDENT_DATA_MODE does for residents: a live dev server can show
 * the meeting mocks before their API exists. Never set by the pipeline.
 */
const TEAM_DATA_MODE = import.meta.env.VITE_TEAM_DATA_MODE || import.meta.env.VITE_DATA_MODE;

export const staffMeetingService: StaffMeetingService = TEAM_DATA_MODE === "live" ? new LiveStaffMeetingService() : new MockStaffMeetingService();
