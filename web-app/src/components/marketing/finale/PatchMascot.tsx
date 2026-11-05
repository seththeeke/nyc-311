import type { ReactElement } from "react";

/*
 * Patch, BoroughSim's mascot: a cheerful little repair truck with big eyes, a
 * spinning beacon and spoked wheels that turn as it drives. Pure SVG; the
 * motion (blink, beacon, wheels) is CSS, so reduced motion stills it.
 */
export function PatchMascot(): ReactElement {
  return (
    <svg viewBox="0 0 220 130" className="h-full w-full overflow-visible" role="img" aria-label="Patch, the BoroughSim repair truck">
      <ellipse cx="112" cy="124" rx="96" ry="5" fill="black" opacity="0.35" />
      <rect x="92" y="6" width="14" height="10" rx="4" fill="var(--t-hue-amber)" className="animate-[mk-beacon_0.9s_steps(2)_infinite]" />
      <rect x="18" y="38" width="120" height="66" rx="12" fill="var(--t-hue-orange)" />
      <rect x="18" y="66" width="120" height="10" fill="var(--t-hue-cyan)" />
      <text x="78" y="61" textAnchor="middle" fontSize="15" fontWeight="900" fill="var(--t-surface)">BoroughSim</text>
      <path d="M138 30 H170 Q182 30 188 44 L202 72 Q206 80 206 88 V104 H138 Z" fill="var(--t-hue-amber)" />
      <path d="M148 38 H168 Q176 38 180 47 L190 66 H148 Z" fill="var(--t-surface)" opacity="0.85" />
      <g className="origin-[170px_54px] animate-[mk-eyes_4s_ease-in-out_infinite]">
        <ellipse cx="160" cy="54" rx="6" ry="7" fill="white" />
        <ellipse cx="176" cy="54" rx="6" ry="7" fill="white" />
        <circle cx="162" cy="55" r="3" fill="var(--t-surface)" />
        <circle cx="178" cy="55" r="3" fill="var(--t-surface)" />
      </g>
      <path d="M186 90 Q196 98 206 90" fill="none" stroke="var(--t-surface)" strokeWidth="3" strokeLinecap="round" />
      <rect x="202" y="78" width="8" height="6" rx="2" fill="#fef9c3" />
      {[52, 172].map((cx) => (
        <g key={cx} className="animate-[mk-orbit_0.6s_linear_infinite]" style={{ transformOrigin: `${cx}px 106px`, transformBox: "view-box" }}>
          <circle cx={cx} cy="106" r="17" fill="#1e293b" />
          <circle cx={cx} cy="106" r="8" fill="#94a3b8" />
          <path d={`M${cx - 8} 106 H${cx + 8} M${cx} 98 V114`} stroke="#1e293b" strokeWidth="2.5" />
        </g>
      ))}
    </svg>
  );
}
