interface TabsProps {
  tabs: { key: string; label: string }[];
  active: string;
  onChange: (key: string) => void;
}

export function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div className="flex gap-1 border-b border-[var(--color-border)]">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
            active === t.key
              ? "border-[var(--color-brand-500)] text-[var(--color-brand-500)]"
              : "border-transparent text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
