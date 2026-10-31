import type { ReactElement } from "react";
import type { TeamMember } from "../../models/teamMember";
import { OrgChartNode } from "./OrgChartNode";
import { CEO_ID, TEAM_ROSTER, directReports, memberById } from "./teamRoster";

interface OrgChartProps {
  selectedId: string | null;
  onSelect: (memberId: string | null) => void;
}

/* A short vertical connector between levels; the lines only draw on wide screens, where the chart is laid out as a tree. */
function Tick(): ReactElement {
  return <div aria-hidden="true" className="mx-auto hidden h-5 w-px bg-line-strong lg:block" />;
}

/**
 * The org chart (#146): the CEO with the Chief of Staff alongside, the
 * executives below, and each executive's own reports under them.
 */
export function OrgChart({ selectedId, onSelect }: OrgChartProps): ReactElement {
  const ceo = memberById(CEO_ID);
  const staff = TEAM_ROSTER.find((member) => member.role === "CHIEF_OF_STAFF") ?? null;
  const executives = directReports(CEO_ID).filter((member) => member.role !== "CHIEF_OF_STAFF");
  const node = (member: TeamMember): ReactElement => (
    <OrgChartNode
      member={member}
      selected={member.member_id === selectedId}
      onSelect={() => onSelect(member.member_id === selectedId ? null : member.member_id)}
    />
  );

  return (
    <section aria-label="Org chart">
      <ol className="grid gap-3 lg:grid-cols-[1fr_minmax(0,13rem)_1fr] lg:items-center">
        <li className="hidden lg:block" aria-hidden="true" />
        {ceo && <li>{node(ceo)}</li>}
        {staff && (
          <li className="flex items-center gap-0 lg:max-w-[15rem]">
            <span aria-hidden="true" className="hidden w-6 shrink-0 border-t border-dashed border-line-strong lg:block" />
            <span className="min-w-0 flex-1">{node(staff)}</span>
          </li>
        )}
      </ol>
      <Tick />
      <div aria-hidden="true" className="mx-[12.5%] hidden border-t border-line-strong lg:block" />
      <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:mt-0 lg:grid-cols-4">
        {executives.map((executive) => {
          const reports = directReports(executive.member_id);
          return (
            <li key={executive.member_id}>
              <Tick />
              {node(executive)}
              {reports.length > 0 && (
                <>
                  <Tick />
                  <ul aria-label={`Reports to ${executive.name}`} className="mt-3 space-y-2 border-l border-line-strong pl-3 lg:mt-0">
                    {reports.map((report) => (
                      <li key={report.member_id}>{node(report)}</li>
                    ))}
                  </ul>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
