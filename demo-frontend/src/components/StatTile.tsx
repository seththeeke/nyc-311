interface StatTileProps {
  label: string;
  value: string;
  sublabel?: string;
  accent?: string;
  variant?: "card" | "glass";
}

export function StatTile({ label, value, sublabel, accent, variant = "card" }: StatTileProps) {
  const isGlass = variant === "glass";
  return (
    <div
      className={
        isGlass
          ? "rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] px-4 py-3 backdrop-blur-md"
          : "rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
      }
    >
      <div
        className={`text-xs font-medium uppercase tracking-wide ${
          isGlass ? "text-[var(--color-glass-ink-muted)]" : "text-[var(--color-ink-muted)]"
        }`}
      >
        {label}
      </div>
      <div
        className={`mt-1 text-3xl font-semibold ${isGlass ? "text-[var(--color-glass-ink)]" : "text-[var(--color-ink)]"}`}
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </div>
      {sublabel && (
        <div className={`mt-0.5 text-xs ${isGlass ? "text-[var(--color-glass-ink-soft)]" : "text-[var(--color-ink-soft)]"}`}>{sublabel}</div>
      )}
    </div>
  );
}
