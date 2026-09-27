import { useState, type ReactElement } from "react";
import { Link } from "react-router-dom";
import { useFeatureFlags } from "../../hooks/useFeatureFlags";
import { FeatureFlagEditor } from "../featureFlags/FeatureFlagEditor";
import { FeatureFlagRow } from "../featureFlags/FeatureFlagRow";
import { PAGE_CONTENT_CLASSES } from "../pageLayout";

/**
 * Admin-gated feature flags & experiments (`11-street-condition-implementation.md`
 * §4) — one page of expandable rows, each opening its editor in place,
 * plus a "New flag" row.
 */
export function FeatureFlagsPage(): ReactElement {
  const { flags, isLoading, error, createFlag, updateFlag, deleteFlag } = useFeatureFlags();
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="relative min-h-full overflow-hidden bg-surface">
      <div aria-hidden="true" className="theme-aurora pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-aurora-1 absolute -top-32 -left-32 h-[32rem] w-[32rem] rounded-full bg-emerald-600/30 blur-3xl" />
        <div className="animate-aurora-2 absolute top-1/3 -right-24 h-[28rem] w-[28rem] rounded-full bg-cyan-600/30 blur-3xl" />
      </div>

      <main className={PAGE_CONTENT_CLASSES}>
        <Link to="/admin" className="text-sm font-medium text-fg-muted transition-colors hover:text-fg">
          &larr; Admin
        </Link>
        <h1 className="mt-4 bg-gradient-to-r from-hue-emerald via-hue-cyan to-hue-violet bg-clip-text text-3xl font-black tracking-tight text-transparent sm:text-4xl">
          Feature Flags
        </h1>
        <p className="mt-2 text-fg-subtle">
          Flags and experiments: named treatments, a default, per-entity overrides, and a random percentage split.
        </p>

        {isLoading && <p className="mt-8 text-fg-subtle">Loading…</p>}
        {error && (
          <p role="alert" className="mt-8 text-danger">
            {error.message}
          </p>
        )}

        {flags && (
          <ul className="mt-8 space-y-3">
            {flags.length === 0 && !creating && <li className="text-sm text-fg-subtle">No feature flags yet.</li>}
            {flags.map((flag) => (
              <FeatureFlagRow
                key={flag.flag_key}
                flag={flag}
                expanded={expandedKey === flag.flag_key}
                onToggle={() => setExpandedKey((current) => (current === flag.flag_key ? null : flag.flag_key))}
                onCreate={createFlag}
                onUpdate={updateFlag}
                onDelete={deleteFlag}
              />
            ))}
            {creating ? (
              <li className="glass rounded-xl">
                <h2 className="px-4 pt-3 text-sm font-semibold text-fg">New flag</h2>
                <FeatureFlagEditor onCreate={createFlag} onUpdate={updateFlag} onDelete={deleteFlag} onClose={() => setCreating(false)} />
              </li>
            ) : (
              <li>
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="rounded bg-emerald-600 px-4 py-2 text-sm text-on-accent"
                >
                  + New flag
                </button>
              </li>
            )}
          </ul>
        )}
      </main>
    </div>
  );
}
