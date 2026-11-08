import type { ReactNode } from "react";

interface QueryStateProps<T> {
  data: T | undefined;
  error: Error | null;
  children: (data: T) => ReactNode;
}

/** Loading and error states for one query, so pages only render the data case. */
export function QueryState<T>({ data, error, children }: QueryStateProps<T>) {
  if (error) return <p role="alert" className="text-rose-300">Couldn't load: {error.message}</p>;
  if (data === undefined) return <p className="text-slate-400">Loading…</p>;
  return <>{children(data)}</>;
}
