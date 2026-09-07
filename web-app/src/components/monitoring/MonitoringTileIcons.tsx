import type { ReactElement } from "react";

/*
 * The icon-only glyphs for the Monitoring tiles, extracted from
 * MonitoringPage.tsx to keep that file under the 200-line component cap
 * (CLAUDE.md §5.1). Each is a 24×24 stroke SVG; the tile wrapper supplies
 * the accessible label, so these are decorative here.
 */
const ICON_STROKE_PROPS = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function IngestionIcon(): ReactElement {
  return (
    <svg {...ICON_STROKE_PROPS} className="h-6 w-6">
      <path d="M12 3v11m0 0l-4-4m4 4l4-4" />
      <path d="M4 16v2a3 3 0 003 3h10a3 3 0 003-3v-2" />
    </svg>
  );
}

export function PipelineIcon(): ReactElement {
  return (
    <svg {...ICON_STROKE_PROPS} className="h-6 w-6">
      <circle cx="4.5" cy="12" r="2" />
      <circle cx="12" cy="5.5" r="2" />
      <circle cx="12" cy="18.5" r="2" />
      <circle cx="19.5" cy="12" r="2" />
      <path d="M6.5 12h3M17.5 12h-3M13 7l3.2 3.2M13 17l3.2-3.2" />
    </svg>
  );
}

export function OrdersIcon(): ReactElement {
  return (
    <svg {...ICON_STROKE_PROPS} className="h-6 w-6">
      <path d="M6 4h9l3 3v13a1 1 0 01-1 1H6a1 1 0 01-1-1V5a1 1 0 011-1z" />
      <path d="M9 10h6M9 13h6M9 16h3" />
    </svg>
  );
}

export function OrderEventsIcon(): ReactElement {
  return (
    <svg {...ICON_STROKE_PROPS} className="h-6 w-6">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}

export function LambdaHealthIcon(): ReactElement {
  return (
    <svg {...ICON_STROKE_PROPS} className="h-6 w-6">
      <path d="M4 17V9l8-5 8 5v8l-8 5-8-5z" />
      <path d="M12 12v5M12 12L4.5 8.5M12 12l7.5-3.5" />
    </svg>
  );
}

export function CoverageIcon(): ReactElement {
  return (
    <svg {...ICON_STROKE_PROPS} className="h-6 w-6">
      <path d="M9 3v18M4 7l5-4 5 4M4 17l5 4 5-4" />
      <path d="M15 12h5m-2-2l2 2-2 2" />
    </svg>
  );
}

export function IntegrationTestsIcon(): ReactElement {
  return (
    <svg {...ICON_STROKE_PROPS} className="h-6 w-6">
      <path d="M9 12l2 2 4-4" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

export function ReportsIcon(): ReactElement {
  return (
    <svg {...ICON_STROKE_PROPS} className="h-6 w-6">
      <path d="M5 4h11l3 3v13a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1z" />
      <path d="M8 17v-4M12 17v-7M16 17v-2" />
    </svg>
  );
}

export function DataWarehouseIcon(): ReactElement {
  return (
    <svg {...ICON_STROKE_PROPS} className="h-6 w-6">
      <ellipse cx="12" cy="5" rx="7" ry="3" />
      <path d="M5 5v6c0 1.66 3.13 3 7 3s7-1.34 7-3V5" />
      <path d="M5 11v6c0 1.66 3.13 3 7 3s7-1.34 7-3v-6" />
    </svg>
  );
}
