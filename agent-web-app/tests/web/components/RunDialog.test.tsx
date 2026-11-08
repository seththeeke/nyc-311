import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { makeAgent, makeHealth, makeRun, renderAt, stubApi } from "../fixtures.tsx";

const SLOTTED = makeAgent({
  config: { ...makeAgent({}, "cpo-agent").config, schedule: [{ day: null, time: "05:00", mode: "AUDIT" }, { day: null, time: "08:00", mode: "CONVERSE" }, { day: null, time: "09:00", mode: null }] },
}, "cpo-agent");

function api(extra: Record<string, unknown> = {}) {
  return stubApi({ "/health": makeHealth(), "/agents/cpo-agent": SLOTTED, "/agents/cpo-agent/runs?limit=100": [], ...extra });
}

describe("Run button and dialog", () => {
  it("starts a run with the prompt, how it's used, the mode and Test chat", async () => {
    const fetchMock = api({ "/agents/cpo-agent/run": { agent: "cpo-agent", pid: 9, requestedAt: "2026-11-07T00:00:00Z" } });
    const user = userEvent.setup();
    renderAt("/agents/cpo-agent");
    await user.click(await screen.findByRole("button", { name: "Run cpo-agent now" }));
    const dialog = screen.getByRole("dialog", { name: "Run cpo-agent now" });
    expect(within(dialog).getByRole("radio", { name: "Replace it" })).toBeDisabled();
    await user.type(within(dialog).getByRole("textbox"), "Check the WBR first");
    await user.click(within(dialog).getByRole("radio", { name: "Replace it" }));
    await user.selectOptions(within(dialog).getByRole("combobox"), "AUDIT");
    await user.click(within(dialog).getByRole("checkbox", { name: "Post to Test chat instead of PROD" }));
    await user.click(within(dialog).getByRole("button", { name: "Start run" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(post?.[0]).toBe("/api/agents/cpo-agent/run");
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ prompt: "Check the WBR first", promptMode: "REPLACE", mode: "AUDIT", testChat: true });
    expect(screen.getByRole("status")).toHaveTextContent("Started");
  });

  it("shows why a start failed, and closes on Escape or Cancel without starting", async () => {
    api();
    const user = userEvent.setup();
    renderAt("/agents/cpo-agent");
    await user.click(await screen.findByRole("button", { name: "Run cpo-agent now" }));
    await user.click(screen.getByRole("button", { name: "Start run" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't start: no route /agents/cpo-agent/run");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Run cpo-agent now" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("is disabled while the agent runs, offers no mode or chat choice when there's none, and sits on dashboard cards", async () => {
    const plain = makeAgent({ config: { ...makeAgent().config, schedule: [], teamChatEnv: null } });
    stubApi({
      "/health": makeHealth(),
      "/agents": [makeAgent({ currentRun: makeRun({ status: "RUNNING" }) }, "busy-agent"), plain],
    });
    const user = userEvent.setup();
    renderAt("/");
    expect(await screen.findByRole("button", { name: "Run busy-agent now" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Run cto-agent now" }));
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("tags manual runs in the history and on the run page", async () => {
    stubApi({
      "/health": makeHealth(),
      "/agents/cto-agent": makeAgent(),
      "/agents/cto-agent/runs?limit=100": [makeRun({ manual: true })],
      "/agents/cto-agent/runs/20261107T140004": { ...makeRun({ manual: true }), report: null },
      "/agents/cto-agent/runs/20261107T140004/log?offset=0": { text: "x", offset: 0, nextOffset: 1 },
    });
    const { unmount } = renderAt("/agents/cto-agent");
    expect(await screen.findByText("manual")).toBeInTheDocument();
    unmount();
    renderAt("/agents/cto-agent/runs/20261107T140004");
    expect(await screen.findByText("Manual (Run button)")).toBeInTheDocument();
  });
});
