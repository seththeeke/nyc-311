import type { ReactElement } from "react";
import type { TeamMember } from "../../models/teamMember";
import { PersonaAvatar } from "../residents/PersonaAvatar";

interface OrgChartNodeProps {
  member: TeamMember;
  selected: boolean;
  onSelect: () => void;
}

/** One person on the org chart. Pressing it opens their profile; pressing again closes it. */
export function OrgChartNode({ member, selected, onSelect }: OrgChartNodeProps): ReactElement {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex w-full min-w-0 flex-col items-center gap-2 rounded-xl border p-3 text-center transition-colors focus-visible:outline-2 focus-visible:outline-blue-400 ${
        selected ? "border-blue-500/60 bg-blue-600/10" : "border-line bg-panel hover:bg-panel-hover"
      }`}
    >
      <PersonaAvatar name={member.name} modelKey={member.model_key} size="XL" />
      <span className="min-w-0">
        <span className="block font-semibold leading-tight text-fg">{member.name}</span>
        <span className="mt-0.5 block text-xs text-fg-muted">{member.title}</span>
        <span className="block text-[11px] italic text-fg-subtle">{member.character}</span>
        <span
          className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
            member.kind === "HUMAN" ? "bg-indigo-500/15 text-hue-indigo" : "bg-violet-500/15 text-hue-violet"
          }`}
        >
          {member.kind === "HUMAN" ? "Human" : "AI agent"}
        </span>
      </span>
    </button>
  );
}
