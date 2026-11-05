import type { ReactElement } from "react";
import { INCOMING_COMPLAINTS } from "../journeySteps";

const STAGGER_MS = 380;

/*
 * Step 2: a scanner sweeps the incoming complaints. Street repairs
 * light up cyan and pass; everything else is stamped not serviceable and
 * drops away. The does/doesn't lists make the line explicit.
 */
export function ServiceabilityScene(): ReactElement {
  return (
    <div className="flex h-full flex-col justify-center gap-6">
      <div className="relative">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 z-10 h-0.5 animate-[mk-scan_2.6s_ease-in-out_both] bg-hue-cyan shadow-[0_0_24px_4px_var(--t-hue-cyan)]" />
        <ul className="relative flex flex-col gap-2.5">
          {INCOMING_COMPLAINTS.map((complaint, i) => (
            <li
              key={complaint.label}
              className={`flex w-full items-center justify-between rounded-xl border px-4 py-2 text-sm font-semibold ${complaint.serviceable ? "animate-[mk-pass_0.9s_cubic-bezier(0.2,0.8,0.2,1)_both] border-hue-cyan/60 bg-hue-cyan/10 text-fg" : "animate-[mk-reject_0.9s_cubic-bezier(0.2,0.8,0.2,1)_both] border-line text-fg-subtle"}`}
              style={{ animationDelay: `${i * STAGGER_MS}ms` }}
            >
              <span>{complaint.label}</span>
              <span className={`text-xs font-bold uppercase tracking-wider ${complaint.serviceable ? "text-hue-cyan" : "text-hue-red"}`}>
                {complaint.serviceable ? "✓ Serviceable" : "✕ Not serviceable"}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl border border-hue-cyan/40 bg-hue-cyan/5 p-3">
          <p className="font-bold text-hue-cyan">BoroughSim does</p>
          <p className="mt-1 text-fg-muted">Street repairs: potholes, cave-ins, plates, rough roads</p>
        </div>
        <div className="rounded-xl border border-line p-3">
          <p className="font-bold text-fg-subtle">BoroughSim doesn&apos;t</p>
          <p className="mt-1 text-fg-subtle">Noise, parking, sanitation, and the rest of 311</p>
        </div>
      </div>
    </div>
  );
}
