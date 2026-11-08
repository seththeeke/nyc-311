import type { HealthFinding } from "../../shared/models/healthFinding.ts";

/** Health findings, errors in red, warnings in amber. Renders nothing when there are none. */
export function FindingList({ findings }: { findings: HealthFinding[] }) {
  if (findings.length === 0) return null;
  return (
    <ul className="space-y-1 text-sm">
      {findings.map((finding) => (
        <li key={finding.code} className={finding.severity === "ERROR" ? "text-rose-300" : "text-amber-300"}>
          <span className="font-mono text-xs opacity-70">{finding.code}</span> {finding.message}
        </li>
      ))}
    </ul>
  );
}
