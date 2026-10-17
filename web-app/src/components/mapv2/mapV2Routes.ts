/* Mapv2's routes: the city view, and the dive-in to one Operator's current job. */
export const MAP_V2_PATH = "/mapv2";
export const MAP_V2_JOB_PATTERN = "/mapv2/job/:orderId";

export function mapV2JobPath(orderId: string): string {
  return `${MAP_V2_PATH}/job/${encodeURIComponent(orderId)}`;
}
