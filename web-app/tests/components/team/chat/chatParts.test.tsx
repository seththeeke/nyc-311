import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChannelView } from "../../../../src/components/team/chat/ChannelView";
import { ChatMessageRow } from "../../../../src/components/team/chat/ChatMessageRow";
import { MessageText } from "../../../../src/components/team/chat/MessageText";
import { ReactionBar } from "../../../../src/components/team/chat/ReactionBar";
import { reactionsOf, replyCount } from "../../../../src/components/team/chat/chatChannels";
import { EXECUTIVE, TECH, chatMessage } from "./chatFixtures";

describe("MessageText", () => {
  it("renders markdown and draws known @ tags as chips, the viewer's own highlighted", () => {
    const { container } = render(<MessageText text={"**Bold** and *soft* with `code`\n\n- one\n- two\n\n@Seth @Rex @channel @Nobody [PR](https://example.com/pr)"} />);
    expect(screen.getByText("Bold").tagName).toBe("STRONG");
    expect(screen.getByText("code").tagName).toBe("CODE");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(container.querySelector('[data-mention="Seth"]')).toHaveClass("bg-amber-400/25");
    expect(container.querySelector('[data-mention="channel"]')).toHaveClass("bg-amber-400/25");
    expect(container.querySelector('[data-mention="Rex"]')).toHaveClass("text-hue-indigo");
    expect(container.querySelector('[data-mention="Nobody"]')).toBeNull();
    expect(screen.getByRole("link", { name: "PR" })).toHaveAttribute("href", "https://example.com/pr");
  });

  it("renders a table and never raw HTML or script links", () => {
    const { container } = render(<MessageText text={"| A | B |\n|---|---|\n| 1 | 2 |\n\n<b>raw</b> [x](javascript:alert(1))"} />);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "A" })).toBeInTheDocument();
    expect(container.querySelector("b")).toBeNull();
    expect(screen.getByText("x").closest("a")?.getAttribute("href") ?? "").not.toContain("javascript");
    expect(render(<MessageText text="1. first" />).container.querySelector("ol")).not.toBeNull();
  });
});

describe("MessageText line formatting", () => {
  it("keeps one field per line and bolds a line's opening label", () => {
    const { container } = render(<MessageText text={"Median time to resolve: 11.45 days\nFleet: 5 → 7\nnot a label: here\n```\nCode: kept\n```"} />);
    expect(screen.getByText("Median time to resolve:").tagName).toBe("STRONG");
    expect(screen.getByText("Fleet:").tagName).toBe("STRONG");
    expect(container.querySelectorAll("br").length).toBeGreaterThan(0);
    expect(screen.queryByText("not a label:")).toBeNull();
    expect(container.querySelector("code")?.textContent).toContain("Code: kept");
  });

  it("renders headings and quotes plainly", () => {
    render(<MessageText text={"## Heading\n\n> quoted"} />);
    expect(screen.getByText("Heading").tagName).toBe("P");
    expect(screen.getByText("quoted").closest("blockquote")).not.toBeNull();
  });
});

describe("reactions and counts", () => {
  it("lists reactions as pills with who reacted, dropping empty ones, the CEO's own marked", () => {
    expect(reactionsOf({ ...chatMessage("T1"), reactions: { "🚀": ["cto"], "👀": [] } })).toEqual([{ emoji: "🚀", member_ids: ["cto"] }]);
    render(<ReactionBar reactions={[{ emoji: "🎉", member_ids: ["ceo", "cto"] }]} />);
    expect(screen.getByLabelText(/🎉 2: Seth Theeke, Rex Rivet/)).toHaveClass("border-indigo-400/60");
    expect(render(<ReactionBar reactions={[]} />).container).toBeEmptyDOMElement();
    render(<ReactionBar reactions={[{ emoji: "👀", member_ids: ["integration-tester"] }]} />);
    expect(screen.getByLabelText("👀 1: integration-tester")).toHaveClass("border-line");
    expect(replyCount(1)).toBe("1 reply");
    expect(replyCount(3)).toBe("3 replies");
  });
});

describe("ChatMessageRow", () => {
  it("opens the author's profile from the avatar or the name", async () => {
    const onOpenProfile = vi.fn();
    const user = userEvent.setup();
    render(<ul><ChatMessageRow message={chatMessage("T1")} continued={false} onOpenProfile={onOpenProfile} /></ul>);
    await user.click(screen.getByRole("button", { name: "Pip Sprocketwhistle's profile" }));
    await user.click(screen.getByRole("button", { name: "Pip Sprocketwhistle" }));
    expect(onOpenProfile).toHaveBeenCalledTimes(2);
    expect(onOpenProfile).toHaveBeenCalledWith("devx");
  });

  it("shows author, AGENT badge, tags, reactions and the thread summary, and opens the thread", async () => {
    const onOpen = vi.fn();
    render(<ul><ChatMessageRow message={chatMessage("T1")} continued={false} onOpenThread={onOpen} /></ul>);
    expect(screen.getByText("Pip Sprocketwhistle")).toBeInTheDocument();
    expect(screen.getByText("AGENT")).toBeInTheDocument();
    expect(screen.getByText("DEVX_RUN")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: /1 reply/ }));
    await userEvent.setup().click(screen.getByRole("button", { name: /View thread/ }));
    expect(onOpen).toHaveBeenCalledTimes(2);
    expect(onOpen).toHaveBeenCalledWith("T1");
  });

  it("shows a deleted message as deleted, an edit as edited, and an unknown author by id", () => {
    render(
      <ul>
        <ChatMessageRow message={chatMessage("T3")} continued={false} onOpenThread={vi.fn()} />
        <ChatMessageRow message={{ ...chatMessage("T2"), author_id: "integration-tester", author_kind: "HUMAN", edited_at: "2026-11-01T07:00:00.000Z", reply_count: 2, last_reply_at: null }} continued />
      </ul>
    );
    expect(screen.getByText("This message was deleted.")).toBeInTheDocument();
    expect(screen.queryAllByRole("toolbar")).toHaveLength(0);
    expect(screen.getByText("(edited)")).toBeInTheDocument();
    expect(screen.queryByText("integration-tester")).toBeNull();
  });

  it("names an off-roster author and replier by id", () => {
    render(<ul><ChatMessageRow message={{ ...chatMessage("T1"), author_id: "integration-tester", reply_author_ids: ["integration-tester"] }} continued={false} onOpenThread={vi.fn()} /></ul>);
    expect(screen.getByText("integration-tester")).toBeInTheDocument();
  });
});

describe("ChannelView", () => {
  it("groups by day, folds same-author follow-ups and lists members", () => {
    const followUp = { ...chatMessage("T2"), message_id: "T2b", created_at: "2026-11-01T06:16:00.000Z" };
    render(<ChannelView channel={TECH} messages={[chatMessage("T1"), chatMessage("T2"), followUp, { ...chatMessage("T2"), message_id: "T9", created_at: "2026-11-02T09:00:00.000Z" }]} onOpenThread={vi.fn()} />);
    const region = screen.getByRole("region", { name: "#tech-team" });
    expect(within(region).getByLabelText("4 members")).toBeInTheDocument();
    expect(within(region).getAllByRole("separator")).toHaveLength(2);
    expect(within(region).getAllByText("Rex Rivet")).toHaveLength(2);
    expect(screen.getByRole("textbox", { name: "Message #tech-team" })).toBeDisabled();
  });

  it("says when a channel has no messages, and shows a notice in their place", () => {
    const { unmount } = render(<ChannelView channel={EXECUTIVE} messages={[]} onOpenThread={vi.fn()} />);
    expect(screen.getByText(/No messages yet/)).toBeInTheDocument();
    unmount();
    render(<ChannelView channel={EXECUTIVE} messages={[]} notice={<p>Loading</p>} onOpenThread={vi.fn()} />);
    expect(screen.getByText("Loading")).toBeInTheDocument();
  });
});
