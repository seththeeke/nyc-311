import type { ReactElement } from "react";
import type { JobResult } from "../../models/jobResult";
import { GenericResultTable } from "./GenericResultTable";
import { OrderVolumeByStage7dView } from "./jobRenderers/OrderVolumeByStage7dView";

export interface ResultsViewProps {
  result: JobResult;
}

/*
 * The per-job renderer registry (7-data-warehousing.md §12) — the only
 * place job-specific presentation lives. A job with no entry here falls
 * back to a generic table off `columns` + `rows`.
 */
const RENDERERS: Record<string, (result: JobResult) => ReactElement> = {
  order_volume_by_stage_7d: (result) => <OrderVolumeByStage7dView result={result} />,
};

/** Dispatches on `result.job_name`; generic table for anything unregistered. */
export function ResultsView({ result }: ResultsViewProps): ReactElement {
  const render = RENDERERS[result.job_name];
  return render ? render(result) : <GenericResultTable result={result} />;
}
