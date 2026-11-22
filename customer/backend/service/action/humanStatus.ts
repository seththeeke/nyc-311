/** A status code as words for a prompt or summary: `NOT_SERVICED` → `not serviced`. */
export function humanStatus(status: string): string {
  return status.toLowerCase().replace(/_/g, " ");
}
