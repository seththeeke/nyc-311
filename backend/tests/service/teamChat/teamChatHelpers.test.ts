import { describe, expect, it } from "vitest";
import { parseMentions } from "../../../service/teamChat/teamChatMentions";
import { findSecret } from "../../../service/teamChat/teamChatSecrets";
import { teamChatSeeds } from "../../../service/teamChat/teamChatSeeds";
import { PIP, REX, SETH } from "../../teamChatFixtures";

describe("parseMentions", () => {
  it("maps handles case-insensitively, @channel to CHANNEL, and dedupes", () => {
    expect(parseMentions("@rex and @Rex, @channel please. Ping @Pip", [PIP, REX, SETH])).toEqual(["cto", "CHANNEL", "devx"]);
  });

  it("ignores unknown handles, emails and handles outside the channel", () => {
    expect(parseMentions("mail pip@example.com, @Nobody, @Seth", [PIP, REX])).toEqual([]);
  });
});

describe("findSecret", () => {
  it.each([
    ["AWS access key", "key AKIAABCDEFGHIJKLMNOP leaked"],
    ["private key", "-----BEGIN RSA PRIVATE KEY-----"],
    ["GitHub token", `ghp_${"a".repeat(36)}`],
    ["Anthropic API key", `sk-ant-${"b".repeat(24)}`],
    ["Slack token", "xoxb-1234567890-abc"],
  ])("finds a %s", (name, text) => {
    expect(findSecret(text)).toBe(name);
  });

  it("passes ordinary text", () => {
    expect(findSecret("66 s → 5.5 s · PR #171")).toBeNull();
  });
});

describe("teamChatSeeds", () => {
  it("seeds the roster and both channels in Prod, every channel public and every member known", () => {
    const { members, channels } = teamChatSeeds("PROD");
    expect(members.map((m) => m.member_id)).toEqual(["ceo", "chief-of-staff", "coo", "cpo", "cfo", "cto", "devx", "gen-dev"]);
    expect(channels.map((c) => c.channel_id)).toEqual(["executive-team", "tech-team"]);
    const ids = new Set(members.map((m) => m.member_id));
    for (const channel of channels) {
      expect(channel.visibility).toBe("PUBLIC");
      expect(channel.member_ids.every((id) => ids.has(id))).toBe(true);
    }
    expect(members.find((m) => m.member_id === "devx")?.email).toBe("devx-agent@agents.boroughsim.com");
  });

  it("adds the integration-test member and channel in Test only", () => {
    const { members, channels } = teamChatSeeds("TEST");
    expect(members.at(-1)).toMatchObject({ member_id: "integration-tester", email: "test-admin@boroughsim.com" });
    expect(channels.at(-1)).toMatchObject({ channel_id: "integration-tests", member_ids: ["integration-tester"] });
  });
});
