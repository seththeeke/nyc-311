import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactElement } from "react";

const SHOW_DELAY_MS = 350;
const EDGE_MARGIN = 8;
const ANCHOR_GAP = 8;
const MAX_TEXT_LENGTH = 80;
const CLICKABLE_SELECTOR = "button, a[href], [role='button'], [role='tab'], summary";

interface ActiveTooltip {
  text: string;
  anchor: HTMLElement;
}

/**
 * The tooltip text for a clickable element: `data-tooltip`, else `aria-label`,
 * else its visible text. Elements with a native `title` are skipped so the
 * browser's own tooltip doesn't double up; long text isn't a label, so no tooltip.
 */
export function tooltipTextFor(element: Element): string | null {
  if (element.hasAttribute("title")) return null;
  const raw = element.getAttribute("data-tooltip") ?? element.getAttribute("aria-label") ?? element.textContent ?? "";
  const text = raw.replace(/\s+/g, " ").trim();
  return text.length > 0 && text.length <= MAX_TEXT_LENGTH ? text : null;
}

/**
 * One app-wide hover tooltip for every clickable control (buttons, links,
 * accordion headers, ...), mounted once in the shell — so a new button gets a
 * tooltip without any per-component wiring. Shows after a short delay; hides
 * on leave, click, scroll, or Escape. Placed below the control (above if there's
 * no room) and clamped inside the viewport.
 */
export function TooltipLayer(): ReactElement | null {
  const [active, setActive] = useState<ActiveTooltip | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const anchorRef = useRef<HTMLElement | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);

  const hide = useCallback((): void => {
    window.clearTimeout(timerRef.current);
    anchorRef.current = null;
    setActive(null);
    setPosition(null);
  }, []);

  useEffect(() => {
    const onOver = (event: PointerEvent): void => {
      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest<HTMLElement>(CLICKABLE_SELECTOR) ?? null;
      if (anchor === anchorRef.current) return;
      hide();
      if (!anchor) return;
      const text = tooltipTextFor(anchor);
      if (!text) return;
      anchorRef.current = anchor;
      timerRef.current = window.setTimeout(() => setActive({ text, anchor }), SHOW_DELAY_MS);
    };
    const onOut = (event: PointerEvent): void => {
      const anchor = anchorRef.current;
      const next = event.relatedTarget instanceof Node ? event.relatedTarget : null;
      if (anchor && !(next && anchor.contains(next))) hide();
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") hide();
    };
    document.addEventListener("pointerover", onOver);
    document.addEventListener("pointerout", onOut);
    document.addEventListener("pointerdown", hide);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", hide, true);
    return () => {
      window.clearTimeout(timerRef.current);
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerout", onOut);
      document.removeEventListener("pointerdown", hide);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", hide, true);
    };
  }, [hide]);

  useLayoutEffect(() => {
    const bubble = bubbleRef.current;
    if (!active || !bubble) return;
    const anchorRect = active.anchor.getBoundingClientRect();
    const { width, height } = bubble.getBoundingClientRect();
    const centered = anchorRect.left + anchorRect.width / 2 - width / 2;
    const left = Math.max(EDGE_MARGIN, Math.min(centered, window.innerWidth - width - EDGE_MARGIN));
    const below = anchorRect.bottom + ANCHOR_GAP;
    const top = below + height + EDGE_MARGIN > window.innerHeight ? anchorRect.top - ANCHOR_GAP - height : below;
    setPosition({ top, left });
  }, [active]);

  if (!active) return null;
  return (
    <div
      ref={bubbleRef}
      role="tooltip"
      style={{ top: position?.top ?? 0, left: position?.left ?? 0, visibility: position ? "visible" : "hidden" }}
      className="pointer-events-none fixed z-[3000] max-w-64 rounded-md bg-tooltip px-2 py-1 text-xs font-medium text-tooltip-fg shadow-lg"
    >
      {active.text}
    </div>
  );
}
