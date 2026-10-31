import type { ReactElement } from "react";
import type { ActionItem } from "../../models/staffMeeting";
import { STATUS_CLASSES, STATUS_LABEL, meetingDay } from "./teamFormat";
import { memberById } from "./teamRoster";

const ISSUES_URL = "https://github.com/seththeeke/nyc-311/issues";

interface ActionItemListProps {
  items: readonly ActionItem[];
  /** The meeting on show; items raised in an earlier one are marked as carried. */
  meetingId: string;
}

/** Every action item the meeting reviewed: owner, due date, status and, once known, its measured outcome. */
export function ActionItemList({ items, meetingId }: ActionItemListProps): ReactElement {
  if (items.length === 0) return <p className="text-sm text-fg-muted">No action items.</p>;
  return (
    <ul aria-label="Action items" className="space-y-2">
      {items.map((item) => (
        <li key={item.action_id} className="rounded-xl border border-line bg-panel p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-fg">{item.title}</p>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CLASSES[item.status]}`}>{STATUS_LABEL[item.status]}</span>
          </div>
          <p className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-fg-subtle">
            <span>{memberById(item.owner_id)?.name ?? item.owner_id}</span>
            <span>Due {meetingDay(item.due_on)}</span>
            {item.raised_in !== meetingId && <span>Carried from {item.raised_in.replace("SM-", "")}</span>}
            {item.issue_number !== null && (
              <a href={`${ISSUES_URL}/${item.issue_number}`} target="_blank" rel="noreferrer" className="text-hue-sky hover:underline">
                #{item.issue_number}
              </a>
            )}
          </p>
          {item.outcome && <p className="mt-1.5 text-xs text-fg-muted">{item.outcome}</p>}
        </li>
      ))}
    </ul>
  );
}
