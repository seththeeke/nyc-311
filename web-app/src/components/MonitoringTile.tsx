import type { ReactElement } from "react";
import { Link } from "react-router-dom";

export interface MonitoringTileProps {
  title: string;
  description: string;
  to: string;
}

export function MonitoringTile({ title, description, to }: MonitoringTileProps): ReactElement {
  return (
    <Link
      to={to}
      className="block rounded-lg border border-slate-200 p-5 hover:border-blue-400 hover:shadow-sm"
    >
      <h2 className="text-lg font-medium text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
    </Link>
  );
}
