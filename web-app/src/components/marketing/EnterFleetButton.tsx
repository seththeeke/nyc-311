import { useEffect, useRef, useState, type PointerEvent, type ReactElement } from "react";

interface EnterFleetButtonProps {
  onEnter: () => void;
  size?: "MD" | "LG";
  /** Selects (focuses) the button this long after mount, so Enter works straight away; skipped if the visitor has focused something else. */
  autoSelectDelayMs?: number;
}

/* How far the button leans toward the pointer, as a share of the pointer's offset from its centre. */
const MAGNET_PULL = 0.3;

/**
 * The page's call to action: a spinning conic rim, a pulsing halo, a light
 * sweep and a magnetic lean toward the pointer. While selected it glows, so
 * Enter works straight away. Clicking it enters the fleet map.
 */
export function EnterFleetButton({ onEnter, size = "MD", autoSelectDelayMs }: EnterFleetButtonProps): ReactElement {
  const ref = useRef<HTMLButtonElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [selected, setSelected] = useState(false);

  useEffect(() => {
    if (autoSelectDelayMs === undefined) return undefined;
    const timer = window.setTimeout(() => {
      if (document.activeElement === null || document.activeElement === document.body) ref.current?.focus({ preventScroll: true });
    }, autoSelectDelayMs);
    return () => window.clearTimeout(timer);
  }, [autoSelectDelayMs]);

  const onMove = (event: PointerEvent<HTMLButtonElement>): void => {
    const box = event.currentTarget.getBoundingClientRect();
    setOffset({
      x: (event.clientX - (box.left + box.width / 2)) * MAGNET_PULL,
      y: (event.clientY - (box.top + box.height / 2)) * MAGNET_PULL,
    });
  };

  const padding = size === "LG" ? "px-10 py-5 text-xl" : "px-9 py-4 text-lg";
  return (
    <span className="relative inline-flex">
      <button
        ref={ref}
        type="button"
        onClick={onEnter}
        onFocus={() => setSelected(true)}
        onBlur={() => setSelected(false)}
        onPointerMove={onMove}
        onPointerLeave={() => setOffset({ x: 0, y: 0 })}
        style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${selected ? 1.06 : 1})` }}
        data-selected={selected}
        className="mk-rim group relative inline-flex rounded-full p-[2px] outline-none transition-transform duration-300 ease-out data-[selected=true]:shadow-[0_0_60px_6px_var(--t-hue-cyan)]"
      >
        <span aria-hidden="true" className="absolute -inset-1.5 animate-[mk-halo_2.2s_ease-out_infinite] rounded-full border-2 border-hue-cyan" />
        <span aria-hidden="true" className="absolute -inset-1.5 animate-[mk-halo_2.2s_ease-out_1.1s_infinite] rounded-full border-2 border-hue-violet" />
        <span className={`relative inline-flex items-center gap-3 overflow-hidden rounded-full bg-surface font-bold text-fg ${padding}`}>
          <span aria-hidden="true" className="mk-shine absolute inset-y-0 -left-1/2 w-1/2" />
          <span className="relative">Enter fleet</span>
          <span aria-hidden="true" className="relative inline-block transition-transform duration-300 group-hover:translate-x-1.5 group-data-[selected=true]:translate-x-1.5">
            →
          </span>
        </span>
      </button>
    </span>
  );
}
