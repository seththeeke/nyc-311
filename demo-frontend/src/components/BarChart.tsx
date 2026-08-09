interface BarDatum {
  label: string;
  value: number;
  color: string;
}

interface BarChartProps {
  data: BarDatum[];
  valueFormatter?: (v: number) => string;
  dark?: boolean;
}

export function BarChart({ data, valueFormatter = (v) => String(v), dark = false }: BarChartProps) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const labelClass = dark ? "text-[var(--color-glass-ink-soft)]" : "text-[var(--color-ink-soft)]";
  const trackClass = dark ? "bg-[var(--color-glass-track)]" : "bg-[var(--color-border-soft)]";
  const valueClass = dark ? "text-[var(--color-glass-ink)]" : "text-[var(--color-ink)]";
  return (
    <div className="flex flex-col gap-2.5">
      {data.map((d) => (
        <div key={d.label} className="grid grid-cols-[110px_1fr_44px] items-center gap-2" title={`${d.label}: ${valueFormatter(d.value)}`}>
          <div className={`truncate text-xs ${labelClass}`}>{d.label}</div>
          <div className={`h-2 rounded-full ${trackClass}`}>
            <div
              className="h-2 rounded-full transition-[width]"
              style={{ width: `${Math.max(3, (d.value / max) * 100)}%`, background: d.color }}
            />
          </div>
          <div className={`text-right text-xs font-medium tabular-nums ${valueClass}`}>{valueFormatter(d.value)}</div>
        </div>
      ))}
    </div>
  );
}

interface SplitBarProps {
  segments: { label: string; value: number; color: string }[];
  dark?: boolean;
}

export function SplitBar({ segments, dark = false }: SplitBarProps) {
  const total = Math.max(1, segments.reduce((sum, s) => sum + s.value, 0));
  const trackClass = dark ? "bg-[var(--color-glass-track)]" : "bg-[var(--color-border-soft)]";
  const labelClass = dark ? "text-[var(--color-glass-ink-soft)]" : "text-[var(--color-ink-soft)]";
  return (
    <div>
      <div className={`flex h-3 w-full overflow-hidden rounded-full ${trackClass}`}>
        {segments.map((s, i) => (
          <div
            key={s.label}
            title={`${s.label}: ${s.value}`}
            style={{ width: `${(s.value / total) * 100}%`, background: s.color, marginLeft: i > 0 ? 2 : 0 }}
            className="h-full first:rounded-l-full last:rounded-r-full"
          />
        ))}
      </div>
      <div className={`mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs ${labelClass}`}>
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />
            {s.label} &middot; {total ? Math.round((s.value / total) * 100) : 0}%
          </div>
        ))}
      </div>
    </div>
  );
}
