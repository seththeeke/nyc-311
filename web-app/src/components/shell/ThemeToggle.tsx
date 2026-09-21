import type { ReactElement } from "react";
import { useTheme } from "../../hooks/useTheme";
import { ROW_BASE_CLASSES, rowStateClasses } from "./SidebarLink";
import { MoonIcon, SunIcon } from "./shellIcons";

interface ThemeToggleProps {
  collapsed: boolean;
}

/** Dark/light switch — a toggle button (`aria-pressed` = dark theme on) with a stable label, icon-only when the rail is collapsed. */
export function ThemeToggle({ collapsed }: ThemeToggleProps): ReactElement {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "DARK";
  const Icon = isDark ? MoonIcon : SunIcon;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-pressed={isDark}
      aria-label="Dark theme"
      className={`${ROW_BASE_CLASSES} ${rowStateClasses(false)} ${collapsed ? "justify-center px-0" : ""}`}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {!collapsed && <span>{isDark ? "Dark theme" : "Light theme"}</span>}
    </button>
  );
}
