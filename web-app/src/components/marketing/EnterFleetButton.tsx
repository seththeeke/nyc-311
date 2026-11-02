import { useState, type PointerEvent, type ReactElement } from "react";

interface EnterFleetButtonProps {
  onEnter: () => void;
  size?: "MD" | "LG";
}

/* How far the button leans toward the pointer, as a share of the pointer's offset from its centre. */
const MAGNET_PULL = 0.3;

/**
 * The page's one call to action: a spinning conic-gradient rim and a
 * magnetic lean toward the pointer. Clicking it enters the fleet map.
 */
export function EnterFleetButton({ onEnter, size = "MD" }: EnterFleetButtonProps): ReactElement {
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const onMove = (event: PointerEvent<HTMLButtonElement>): void => {
    const box = event.currentTarget.getBoundingClientRect();
    setOffset({
      x: (event.clientX - (box.left + box.width / 2)) * MAGNET_PULL,
      y: (event.clientY - (box.top + box.height / 2)) * MAGNET_PULL,
    });
  };

  const padding = size === "LG" ? "px-10 py-5 text-xl" : "px-7 py-3.5 text-base";
  return (
    <button
      type="button"
      onClick={onEnter}
      onPointerMove={onMove}
      onPointerLeave={() => setOffset({ x: 0, y: 0 })}
      style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
      className="mk-rim group relative inline-flex rounded-full p-[2px] transition-transform duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-hue-cyan"
    >
      <span className={`relative inline-flex items-center gap-3 rounded-full bg-surface font-semibold text-fg ${padding}`}>
        Enter fleet
        <span aria-hidden="true" className="inline-block transition-transform duration-300 group-hover:translate-x-1.5">
          →
        </span>
      </span>
    </button>
  );
}
