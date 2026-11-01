import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { channelById, channelMessages, meetingMessages, replyCount } from "../../../../src/components/team/chat/chatChannels";
import { ChatMessageRow } from "../../../../src/components/team/chat/ChatMessageRow";
import { MessageText } from "../../../../src/components/team/chat/MessageText";
import { MOCK_STAFF_MEETINGS } from "../../../../src/test-data/staffMeetings";

describe("MessageText", () => {
  it("draws known tags as mentions, the viewer's and @channel highlighted, and leaves unknown ones as text", () => {
    const { container } = render(<MessageText text="@Brogan and @Seth, @channel please, not @nobody." />);
    expect(container.querySelector('[data-mention="Brogan"]')?.className).toContain("text-hue-indigo");
    expect(container.querySelector('[data-mention="Seth"]')?.className).toContain("bg-amber-400/25");
    expect(container.querySelector('[data-mention="channel"]')).not.toBeNull();
    expect(container.querySelector('[data-mention="nobody"]')).toBeNull();
    expect(container).toHaveTextContent("not @nobody.");
  });
});

describe("chat data", () => {
  it("threads each meeting's action items under the minutes, tagging the Chief of Staff, and falls back to the first channel", () => {
    const minutes = meetingMessages(MOCK_STAFF_MEETINGS).filter((message) => message.meeting);
    expect(minutes).toHaveLength(MOCK_STAFF_MEETINGS.length);
    expect(minutes[0].replies?.[0].text).toMatch(/^@Penny on it: /);
    expect(channelById("nope").channel_id).toBe("executive-team");
    expect(channelMessages(channelById("tech-team"), []).length).toBeGreaterThan(5);
    const guest = meetingMessages([{ ...MOCK_STAFF_MEETINGS[0], notes_by: "guest" }]).find((message) => message.meeting);
    expect(guest?.replies?.[0].text).toMatch(/^@guest on it: /);
    expect([replyCount(1), replyCount(2)]).toEqual(["1 reply", "2 replies"]);
  });
});

describe("ChatMessageRow", () => {
  const thread = channelMessages(channelById("tech-team"), []).find((message) => message.message_id === "T7")!;

  it("toggles your reaction, adds one from the picker, and opens the thread", async () => {
    const user = userEvent.setup();
    const open = vi.fn();
    render(<ol><ChatMessageRow message={thread} continued={false} onOpenThread={open} /></ol>);
    const salute = screen.getByRole("button", { name: /^🫡 3/ });
    expect(salute).toHaveAttribute("aria-pressed", "false");
    await user.click(salute);
    expect(screen.getByRole("button", { name: /^🫡 4/ })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: /^🫡 4/ }));
    expect(screen.getByRole("button", { name: /^🫡 3/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "😀 Add reaction" }));
    await user.click(within(screen.getByRole("group", { name: "Pick a reaction" })).getByRole("button", { name: "React 🎉" }));
    expect(screen.getByRole("button", { name: /^🎉 1: Seth Theeke/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^🎉 1/ }));
    expect(screen.queryByRole("button", { name: /^🎉/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /3 replies/ }));
    await user.click(screen.getByRole("button", { name: "💬 Reply in thread" }));
    expect(open).toHaveBeenCalledWith("T7");
  });

  it("shows no thread controls inside a thread, says reply for one, and names an unknown author by id", () => {
    render(<ol><ChatMessageRow message={{ ...thread, author_id: "guest", reactions: undefined, replies: [thread.replies![0]] }} continued={false} onOpenThread={vi.fn()} /></ol>);
    expect(screen.getByText("guest")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /1 reply/ })).toBeInTheDocument();
    render(<ol><ChatMessageRow message={thread} continued /></ol>);
    expect(screen.getAllByRole("button", { name: "💬 Reply in thread" })).toHaveLength(1);
  });
});
