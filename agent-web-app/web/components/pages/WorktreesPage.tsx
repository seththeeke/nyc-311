import { useWorktrees } from "../../hooks/queries.ts";
import { QueryState } from "../QueryState.tsx";
import { formatWhen } from "../format.ts";

/** Worktrees of both checkouts. Hand-run leftovers in the primary checkout are never pruned, so they're called out. */
export function WorktreesPage() {
  const { data, error } = useWorktrees();
  return (
    <QueryState data={data} error={error}>
      {(worktrees) => (
        <table className="w-full text-left text-sm">
          <thead className="text-slate-400">
            <tr>
              <th className="py-1 pr-3 font-normal">Worktree</th>
              <th className="py-1 pr-3 font-normal">Branch</th>
              <th className="py-1 pr-3 font-normal">Agent</th>
              <th className="py-1 pr-3 font-normal">Created</th>
              <th className="py-1 font-normal">Changed files</th>
            </tr>
          </thead>
          <tbody>
            {worktrees.map((worktree) => (
              <tr key={worktree.path} className="border-t border-slate-800 align-top">
                <td className="py-1 pr-3 font-mono text-xs leading-5 break-all">
                  {worktree.path}
                  {worktree.isPrimary && <span className="ml-2 text-slate-400">(checkout)</span>}
                </td>
                <td className="py-1 pr-3">{worktree.branch ?? `detached ${worktree.head ?? ""}`}</td>
                <td className="py-1 pr-3">{worktree.agent ?? "—"}</td>
                <td className="py-1 pr-3">{formatWhen(worktree.createdAt)}</td>
                <td className={`py-1 ${worktree.dirtyCount > 0 ? "text-amber-300" : ""}`}>{worktree.dirtyCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </QueryState>
  );
}
