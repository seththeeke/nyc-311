import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Agent } from "../../shared/models/agent.ts";
import type { PromptMode } from "../../shared/models/runRequest.ts";
import { useStartRun } from "../hooks/queries.ts";

interface RunDialogProps {
  agent: Agent;
  onClose: (started: boolean) => void;
}

/** Asks for an optional prompt and starts the agent outside its schedule (SPEC.md §5.1). */
export function RunDialog({ agent, onClose }: RunDialogProps) {
  const { config } = agent;
  const modes = [...new Set(config.schedule.map((slot) => slot.mode).filter((mode): mode is string => mode !== null))];
  const [prompt, setPrompt] = useState("");
  const [promptMode, setPromptMode] = useState<PromptMode>("APPEND");
  const [mode, setMode] = useState("");
  const [testChat, setTestChat] = useState(false);
  const start = useStartRun(config.name);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => promptRef.current?.focus(), []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    start.mutate({ prompt, promptMode, mode: mode || null, testChat }, { onSuccess: () => onClose(true) });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form role="dialog" aria-modal="true" aria-labelledby="run-dialog-title" onSubmit={submit} className="w-full max-w-lg space-y-4 rounded-lg border border-slate-700 bg-slate-900 p-5 text-sm">
        <h2 id="run-dialog-title" className="text-base font-semibold">Run {config.name} now</h2>
        <p className="text-amber-200">
          This is a real run, outside the schedule: the agent works with all its usual tools and permissions, and its posts and changes are real.
        </p>
        <label className="block space-y-1">
          <span className="text-slate-300">Prompt (optional)</span>
          <textarea ref={promptRef} value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={5} maxLength={4000}
            placeholder="Leave empty to run its scheduled prompt" className="w-full rounded border border-slate-700 bg-slate-950 p-2 font-mono text-xs" />
        </label>
        <fieldset disabled={prompt.trim() === ""} className="flex gap-4 disabled:opacity-50">
          <legend className="sr-only">How the prompt is used</legend>
          {(["APPEND", "REPLACE"] as const).map((value) => (
            <label key={value} className="flex items-center gap-2">
              <input type="radio" name="promptMode" checked={promptMode === value} onChange={() => setPromptMode(value)} />
              {value === "APPEND" ? "Add to the scheduled prompt" : "Replace it"}
            </label>
          ))}
        </fieldset>
        {modes.length > 0 && (
          <label className="flex items-center gap-2">
            <span className="text-slate-300">Mode</span>
            <select value={mode} onChange={(event) => setMode(event.target.value)} className="rounded border border-slate-700 bg-slate-950 p-1">
              <option value="">Nearest slot's</option>
              {modes.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
        )}
        {config.teamChatEnv && (
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={testChat} onChange={(event) => setTestChat(event.target.checked)} />
            Post to Test chat instead of {config.teamChatEnv}
          </label>
        )}
        {start.error && <p role="alert" className="text-rose-300">Couldn't start: {start.error.message}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => onClose(false)} className="rounded px-3 py-1.5 text-slate-300 hover:bg-slate-800">Cancel</button>
          <button type="submit" disabled={start.isPending} className="rounded bg-emerald-600 px-3 py-1.5 font-medium text-white hover:bg-emerald-500 disabled:opacity-50">
            {start.isPending ? "Starting…" : "Start run"}
          </button>
        </div>
      </form>
    </div>
  );
}
