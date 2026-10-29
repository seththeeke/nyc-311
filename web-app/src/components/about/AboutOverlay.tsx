import { useEffect, useRef, useState, type ReactElement } from "react";
import { createPortal } from "react-dom";
import { ABOUT_OVERVIEW, ABOUT_SECTIONS } from "./aboutSections";
import { AboutSectionItem } from "./AboutSectionItem";

export interface AboutOverlayProps {
  onClose: () => void;
}

/**
 * Memo-style About drawer, docked to the right edge at ~40% of the
 * viewport so the map behind stays visible. Non-modal; no navigation. Closes
 * on Escape or the close button, restoring focus to the opener. Portaled to
 * `document.body` so it isn't clipped by the sidebar it's opened from.
 */
export function AboutOverlay({ onClose }: AboutOverlayProps): ReactElement {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(new Set());

  const toggleSection = (id: string): void =>
    setExpandedIds((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      opener?.focus();
    };
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-labelledby="about-title"
      className="animate-fade-in fixed top-0 right-0 bottom-0 z-[2000] w-full overflow-hidden border-l border-line bg-surface text-fg shadow-2xl md:w-[40vw] md:min-w-[26rem]"
    >
      <div aria-hidden="true" className="theme-aurora pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-aurora-1 absolute -top-40 -left-16 h-[22rem] w-[22rem] rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="animate-aurora-2 absolute -right-24 -bottom-32 h-[20rem] w-[20rem] rounded-full bg-blue-600/15 blur-3xl" />
      </div>

      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label="Close About"
        className="absolute top-4 right-5 z-10 rounded-full border border-line bg-panel px-3 py-1.5 text-sm font-medium text-fg-muted hover:bg-panel-hover"
      >
        Close
      </button>

      <div className="relative h-full overflow-y-auto">
        <article className="px-8 py-10">
          <h1
            id="about-title"
            className="bg-gradient-to-r from-hue-cyan via-hue-blue to-hue-violet bg-clip-text pr-20 text-3xl font-black tracking-tight text-transparent"
          >
            About BoroughSim
          </h1>

          <div className="mt-5 space-y-3">
            {ABOUT_OVERVIEW.map((paragraph) => (
              <p key={paragraph} className="leading-relaxed text-fg">
                {paragraph}
              </p>
            ))}
          </div>

          <div className="mt-8 border-b border-line">
            {ABOUT_SECTIONS.map((section) => (
              <AboutSectionItem
                key={section.id}
                section={section}
                expanded={expandedIds.has(section.id)}
                onToggle={() => toggleSection(section.id)}
              />
            ))}
          </div>
        </article>
      </div>
    </div>,
    document.body
  );
}
