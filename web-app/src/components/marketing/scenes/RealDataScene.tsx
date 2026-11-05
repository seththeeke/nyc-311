import type { ReactElement } from "react";
import { SAMPLE_311_RECORD } from "../journeySteps";

const LINE_STAGGER_MS = 260;

/*
 * Step 1, the one real-world step, styled apart from the rest: a raw NYC Open
 * Data record typing itself out in a terminal, under a live REAL DATA badge.
 */
export function RealDataScene(): ReactElement {
  return (
    <div className="flex h-full flex-col justify-center gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2 rounded-full bg-hue-amber px-3 py-1 text-xs font-black uppercase tracking-widest text-surface">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-surface opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-surface" />
          </span>
          Real data
        </span>
        <span className="text-sm font-medium text-hue-amber">NYC Open Data · 311 Service Requests</span>
      </div>
      <div className="mk-terminal overflow-hidden rounded-2xl border border-hue-amber/40 font-mono text-[13px] leading-6 shadow-[0_0_60px_-20px_var(--t-hue-amber)] sm:text-sm">
        <div className="flex items-center gap-1.5 border-b border-line px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-hue-red" />
          <span className="h-2.5 w-2.5 rounded-full bg-hue-amber" />
          <span className="h-2.5 w-2.5 rounded-full bg-hue-emerald" />
          <span className="ml-3 truncate text-xs text-fg-subtle">GET data.cityofnewyork.us/resource/erm2-nwe9.json</span>
        </div>
        <div className="px-4 py-3 text-fg-muted">
          <p>{"{"}</p>
          {SAMPLE_311_RECORD.map(([key, value], i) => (
            <p
              key={key}
              className="animate-[mk-rise_0.5s_ease-out_both] whitespace-nowrap pl-4"
              style={{ animationDelay: `${i * LINE_STAGGER_MS}ms` }}
            >
              <span className="text-hue-amber">&quot;{key}&quot;</span>: <span className={key === "complaint_type" || key === "descriptor" ? "font-bold text-fg" : "text-hue-sky"}>{value}</span>
              {i < SAMPLE_311_RECORD.length - 1 ? "," : ""}
            </p>
          ))}
          <p className="animate-[mk-rise_0.5s_ease-out_both]" style={{ animationDelay: `${SAMPLE_311_RECORD.length * LINE_STAGGER_MS}ms` }}>
            {"}"}
            <span aria-hidden="true" className="ml-1 inline-block h-4 w-2 translate-y-0.5 animate-[mk-blink_1s_steps(1)_infinite] bg-hue-amber" />
          </p>
        </div>
      </div>
      <p className="text-xs text-fg-subtle">The record&apos;s shape, with its real field names. Live records stream in all day.</p>
    </div>
  );
}
