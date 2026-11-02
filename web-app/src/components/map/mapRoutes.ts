/* The map's routes: the city view, and the dive-in to one Operator's current job. */
export const MAP_PATH = "/";
export const MAP_JOB_PATTERN = "/job/:orderId";

export function mapJobPath(orderId: string): string {
  return `/job/${encodeURIComponent(orderId)}`;
}
