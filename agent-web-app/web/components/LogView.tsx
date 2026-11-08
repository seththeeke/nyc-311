/** The raw run log, monospace and scrollable. */
export function LogView({ text }: { text: string }) {
  return (
    <pre className="max-h-[32rem] overflow-auto rounded border border-slate-800 bg-black/40 p-3 text-xs leading-5 whitespace-pre-wrap">
      {text || "(empty)"}
    </pre>
  );
}
