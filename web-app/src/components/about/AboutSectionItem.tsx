import type { ReactElement } from "react";
import { ConstructionIcon } from "../icons";
import type { AboutSection } from "./aboutSections";

export interface AboutSectionItemProps {
  section: AboutSection;
  expanded: boolean;
  onToggle: () => void;
}

/**
 * One heading of the About document: title and a one-line "where it's used"
 * summary always show; the full content unfolds beneath. The body stays
 * mounted and animates its grid row between 0fr and 1fr so neighbours slide
 * rather than jump, reading as one continuous page. Collapsed content is
 * `inert` and `aria-hidden` so it is out of the tab order and the a11y tree.
 */
export function AboutSectionItem({ section, expanded, onToggle }: AboutSectionItemProps): ReactElement {
  const buttonId = `about-${section.id}-button`;
  const panelId = `about-${section.id}-panel`;

  return (
    <section className="border-t border-line">
      <h2>
        <button
          id={buttonId}
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={panelId}
          className="group flex w-full items-start gap-3 py-4 text-left"
        >
          <span
            aria-hidden="true"
            className={`mt-0.5 w-3 shrink-0 text-fg-subtle transition-transform duration-300 group-hover:text-fg-muted motion-reduce:transition-none ${expanded ? "rotate-90" : ""}`}
          >
            ›
          </span>
          <span>
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-lg font-semibold text-fg">
              {section.title}
              {section.status === "IN_PROGRESS" && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-xs font-medium text-hue-amber">
                  <ConstructionIcon className="h-3.5 w-3.5" />
                  Work In Progress
                </span>
              )}
            </span>
            <span className="mt-0.5 block text-sm font-normal text-fg-subtle">{section.summary}</span>
          </span>
        </button>
      </h2>
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden">
          <div
            id={panelId}
            role="region"
            aria-labelledby={buttonId}
            aria-hidden={!expanded}
            inert={!expanded}
            className="space-y-3 pb-5 pl-6"
          >
            {section.body === null ? (
              <p className="text-fg-subtle italic">Work in progress — details coming soon.</p>
            ) : (
              section.body.map((paragraph) => (
                <p key={paragraph} className="leading-relaxed text-fg-muted">
                  {paragraph}
                </p>
              ))
            )}
            {section.tags.length > 0 && (
              <ul aria-label={`${section.title} concepts`} className="flex flex-wrap gap-1.5 pt-1">
                {section.tags.map((tag) => (
                  <li key={tag} className="rounded-full border border-line bg-panel px-2.5 py-0.5 text-xs text-fg-muted">
                    {tag}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
