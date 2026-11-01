import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TeamChatDao } from "../../../dao/teamChat/teamChatDao";
import { ForbiddenError, NotFoundError, ValidationError } from "../../../models/errors";
import * as service from "../../../service/teamChat/teamChatService";
import { PIP, REX, SETH, TECH, message } from "../../teamChatFixtures";

function fakeDao(): { [K in keyof TeamChatDao]: ReturnType<typeof vi.fn> } {
  return {
    listChannels: vi.fn().mockResolvedValue([TECH, { ...TECH, channel_id: "hidden", name: "hidden", visibility: "PRIVATE" }, { ...TECH, channel_id: "alpha", name: "alpha" }]),
    listMembers: vi.fn().mockResolvedValue([PIP, REX, SETH]),
    getChannel: vi.fn().mockResolvedValue(TECH),
    getMessage: vi.fn().mockResolvedValue(message()),
    listTimeline: vi.fn().mockResolvedValue([message({ message_id: "M3" }), message({ message_id: "M2" }), message({ message_id: "M1" })]),
    listReplies: vi.fn().mockResolvedValue([message({ message_id: "R1", thread_id: "M1" })]),
    createMessage: vi.fn().mockImplementation(async (input: { message: unknown }) => ({ message: input.message, replayed: false })),
    updateText: vi.fn().mockResolvedValue(undefined),
    tombstone: vi.fn().mockResolvedValue(undefined),
    setReaction: vi.fn().mockResolvedValue(undefined),
    listInbox: vi.fn().mockResolvedValue([]),
    setInboxRead: vi.fn().mockResolvedValue(undefined),
    upsertChannel: vi.fn(),
    upsertMember: vi.fn(),
  } as never;
}

let dao: ReturnType<typeof fakeDao>;
let ids: number;
const deps = (): service.TeamChatServiceDeps => ({ dao: dao as unknown as TeamChatDao, now: () => new Date("2026-11-01T10:00:00.000Z"), newId: () => `ID${++ids}` });
const body = (text: string) => ({ text, tags: ["DEVX_RUN"], client_token: "token-123456" });

beforeEach(() => {
  dao = fakeDao();
  ids = 0;
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("reads", () => {
  it("lists public channels by name", async () => {
    expect((await service.listPublicChannels(deps())).map((c) => c.channel_id)).toEqual(["alpha", "tech-team"]);
  });

  it("pages the timeline with a next cursor only when more remain", async () => {
    expect(await service.getTimeline("tech-team", { limit: 2 }, deps())).toMatchObject({ next_cursor: "M2", items: [{ message_id: "M3" }, { message_id: "M2" }] });
    expect((await service.getTimeline("tech-team", { limit: 5 }, deps())).next_cursor).toBeNull();
  });

  it("hides a missing or private channel as not found", async () => {
    dao.getChannel.mockResolvedValueOnce(null).mockResolvedValueOnce({ ...TECH, visibility: "PRIVATE" });
    await expect(service.getTimeline("x", { limit: 5 }, deps())).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.getThread("x", "M1", { limit: 5 }, deps())).rejects.toBeInstanceOf(NotFoundError);
  });

  it("returns a thread's root and replies, and 404s a missing root", async () => {
    expect(await service.getThread("tech-team", "M1", { limit: 5 }, deps())).toMatchObject({ root: { message_id: "01M0000000000000000000000A" }, replies: { items: [{ message_id: "R1" }] } });
    dao.getMessage.mockResolvedValueOnce(null);
    await expect(service.getThread("tech-team", "M9", { limit: 5 }, deps())).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("resolveCaller", () => {
  it("matches the email case-insensitively", async () => {
    expect(await service.resolveCaller("DEVX-agent@agents.boroughsim.com", deps())).toEqual(PIP);
  });

  it("refuses an unknown or disabled member", async () => {
    await expect(service.resolveCaller("who@example.com", deps())).rejects.toBeInstanceOf(ForbiddenError);
    dao.listMembers.mockResolvedValueOnce([{ ...PIP, status: "DISABLED" }]);
    await expect(service.resolveCaller(PIP.email ?? "", deps())).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("postMessage", () => {
  it("stamps the author, parses mentions and writes a MENTION inbox entry", async () => {
    const { message: posted } = await service.postMessage(PIP, "tech-team", body("@Rex PR #171 is up"), deps());
    expect(posted).toMatchObject({ author_id: "devx", author_kind: "AGENT", mentions: ["cto"], tags: ["DEVX_RUN"], created_at: "2026-11-01T10:00:00.000Z" });
    const input = dao.createMessage.mock.calls[0][0];
    expect(input.inbox).toEqual([expect.objectContaining({ member_id: "cto", kind: "MENTION" })]);
    expect(input).toMatchObject({ writeCap: service.TEAM_CHAT_DAILY_WRITE_CAP, day: "2026-11-01", clientToken: "token-123456" });
  });

  it("fans @channel out to every other member", async () => {
    await service.postMessage(PIP, "tech-team", body("@channel heads up"), deps());
    expect(dao.createMessage.mock.calls[0][0].inbox.map((e: { member_id: string }) => e.member_id)).toEqual(["ceo", "cto"]);
  });

  it("refuses non-members, missing channels and secrets", async () => {
    await expect(service.postMessage({ ...PIP, member_id: "coo" }, "tech-team", body("hi"), deps())).rejects.toBeInstanceOf(ForbiddenError);
    dao.getChannel.mockResolvedValueOnce(null);
    await expect(service.postMessage(PIP, "nope", body("hi"), deps())).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.postMessage(PIP, "tech-team", body("AKIAABCDEFGHIJKLMNOP"), deps())).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("postReply", () => {
  it("notifies thread participants who weren't mentioned with THREAD_REPLY", async () => {
    dao.getMessage.mockResolvedValueOnce(message({ author_id: "ceo", reply_author_ids: ["cto"] }));
    await service.postReply(PIP, "tech-team", "M1", body("@Rex done"), deps());
    const input = dao.createMessage.mock.calls[0][0];
    expect(input.message.thread_id).toBe("01M0000000000000000000000A");
    expect(input.inbox.map((e: { member_id: string; kind: string }) => `${e.member_id}:${e.kind}`)).toEqual(["cto:MENTION", "ceo:THREAD_REPLY"]);
  });

  it("refuses a reply to a deleted root", async () => {
    dao.getMessage.mockResolvedValueOnce(message({ deleted_at: "2026-11-01T09:00:00.000Z" }));
    await expect(service.postReply(PIP, "tech-team", "M1", body("hi"), deps())).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("edit, delete and react", () => {
  it("edits the author's own message and re-parses mentions", async () => {
    const edited = await service.editMessage(PIP, "tech-team", "M1", null, { text: "@Seth updated" }, deps());
    expect(edited).toMatchObject({ text: "@Seth updated", mentions: ["ceo"], edited_at: "2026-11-01T10:00:00.000Z" });
    expect(dao.updateText).toHaveBeenCalledOnce();
  });

  it("refuses another author's message and a deleted one", async () => {
    await expect(service.editMessage(REX, "tech-team", "M1", null, { text: "x" }, deps())).rejects.toBeInstanceOf(ForbiddenError);
    dao.getMessage.mockResolvedValueOnce(message({ deleted_at: "2026-11-01T09:00:00.000Z" }));
    await expect(service.deleteMessage(PIP, "tech-team", "M1", null, deps())).rejects.toBeInstanceOf(NotFoundError);
  });

  it("tombstones the author's own message", async () => {
    await service.deleteMessage(PIP, "tech-team", "M1", null, deps());
    expect(dao.tombstone).toHaveBeenCalledWith(expect.objectContaining({ message_id: "01M0000000000000000000000A" }), "2026-11-01T10:00:00.000Z");
  });

  it("sets a reaction as a channel member", async () => {
    await service.setReaction(REX, "tech-team", "M1", "R1", "✅", true, deps());
    expect(dao.getMessage).toHaveBeenCalledWith("tech-team", "M1", "R1");
    expect(dao.setReaction).toHaveBeenCalledWith(expect.anything(), "✅", "cto", true);
  });
});

describe("inbox", () => {
  it("reads after the caller's cursor unless ?after= overrides, and marks read", async () => {
    await service.getInbox({ ...REX, inbox_read_id: "E5" }, { limit: 10 }, deps());
    await service.getInbox(REX, { limit: 10, after: "E9" }, deps());
    await service.getInbox(REX, { limit: 10 }, deps());
    expect(dao.listInbox.mock.calls.map((call) => call[1].after)).toEqual(["E5", "E9", undefined]);
    await service.markInboxRead(REX, "E10", deps());
    expect(dao.setInboxRead).toHaveBeenCalledWith("cto", "E10");
  });
});

describe("default dependencies", () => {
  it("builds its DAO from TEAM_CHAT_TABLE_NAME", async () => {
    const saved = process.env.TEAM_CHAT_TABLE_NAME;
    delete process.env.TEAM_CHAT_TABLE_NAME;
    await expect(service.listPublicChannels()).rejects.toThrow("TEAM_CHAT_TABLE_NAME");
    if (saved !== undefined) process.env.TEAM_CHAT_TABLE_NAME = saved;
  });
});

describe("default clock and ids", () => {
  it("stamps the real time and a ULID when none are injected", async () => {
    const { message: posted } = await service.postMessage(PIP, "tech-team", body("hi"), { dao: dao as unknown as TeamChatDao });
    expect(posted.message_id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(Date.parse(posted.created_at)).not.toBeNaN();
  });
});
