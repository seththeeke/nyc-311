import type { ReactElement } from "react";
import type { IconProps } from "../icons";

/*
 * Glyphs for the workspace shell — hand-rolled like components/icons.tsx
 * (no icon library in web-app). Every one is decorative: the control that
 * wraps it supplies the accessible name.
 */
const DEFAULT_CLASS = "h-5 w-5";

function StrokeIcon({ className = DEFAULT_CLASS, children }: IconProps & { children: ReactElement | ReactElement[] }): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const MapIcon = (p: IconProps): ReactElement => (
  <StrokeIcon {...p}>
    <path d="M9 4 3 6.5v13L9 17l6 3 6-2.5v-13L15 7 9 4Z" />
    <path d="M9 4v13m6-10v13" />
  </StrokeIcon>
);

export const MonitorIcon = (p: IconProps): ReactElement => (
  <StrokeIcon {...p}>
    <path d="M3 12h4l2.5-6 4 12L16 12h5" />
  </StrokeIcon>
);

export const AdminIcon = (p: IconProps): ReactElement => (
  <StrokeIcon {...p}>
    <path d="M12 3 4.5 6v5.5c0 4.5 3 8 7.5 9.5 4.5-1.5 7.5-5 7.5-9.5V6L12 3Z" />
    <path d="m9 12 2 2 4-4" />
  </StrokeIcon>
);

export const LockIcon = (p: IconProps): ReactElement => (
  <StrokeIcon {...p}>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </StrokeIcon>
);

export const ChevronIcon = (p: IconProps): ReactElement => (
  <StrokeIcon {...p}>
    <path d="m9 6 6 6-6 6" />
  </StrokeIcon>
);

export const SidebarToggleIcon = (p: IconProps): ReactElement => (
  <StrokeIcon {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M9 4v16" />
  </StrokeIcon>
);

export const SecondaryToggleIcon = (p: IconProps): ReactElement => (
  <StrokeIcon {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M15 4v16" />
  </StrokeIcon>
);

export const MenuIcon = (p: IconProps): ReactElement => (
  <StrokeIcon {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </StrokeIcon>
);

export const SunIcon = (p: IconProps): ReactElement => (
  <StrokeIcon {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
  </StrokeIcon>
);

export const MoonIcon = (p: IconProps): ReactElement => (
  <StrokeIcon {...p}>
    <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" />
  </StrokeIcon>
);

export const InfoIcon = (p: IconProps): ReactElement => (
  <StrokeIcon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5m0-8.5v.01" />
  </StrokeIcon>
);

export const SignOutIcon = (p: IconProps): ReactElement => (
  <StrokeIcon {...p}>
    <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4m5-4 4-4-4-4m4 4H9" />
  </StrokeIcon>
);

export const ExternalLinkIcon = (p: IconProps): ReactElement => (
  <StrokeIcon {...p}>
    <path d="M14 4h6v6m0-6-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
  </StrokeIcon>
);

/** A solid map pin — the BoroughSim brand mark. Filled (not stroked) so it holds its shape at larger sizes. */
export const MapMarkerIcon = ({ className = "h-9 w-9" }: IconProps): ReactElement => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path
      fill="currentColor"
      d="M12 1.5C7.86 1.5 4.5 4.86 4.5 9c0 5.6 6.1 11.7 7.05 12.6a.6.6 0 0 0 .9 0C13.4 20.7 19.5 14.6 19.5 9c0-4.14-3.36-7.5-7.5-7.5Z"
    />
    <circle cx="12" cy="9" r="3" className="fill-surface" />
  </svg>
);
