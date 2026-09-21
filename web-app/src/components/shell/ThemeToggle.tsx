import type { ComponentType, ReactElement } from "react";
import { useTheme } from "../../hooks/useTheme";
import type { IconProps } from "../icons";
import type { ThemeName } from "../../models/theme";
import { MoonIcon, SunIcon } from "./shellIcons";

interface ThemeToggleProps {
  collapsed: boolean;
}

interface ThemeOption {
  theme: ThemeName;
  label: string;
  icon: ComponentType<IconProps>;
}

/* Sun on the left, moon on the right. */
const OPTIONS: readonly ThemeOption[] = [
  { theme: "LIGHT", label: "Light theme", icon: SunIcon },
  { theme: "DARK", label: "Dark theme", icon: MoonIcon },
];

/**
 * Light/dark switch as a two-option radio group: sun and moon either side of
 * one pill, the active one highlighted. Native radios (visually hidden) give
 * arrow-key selection and a proper `radiogroup` for free. Sits on the same
 * row as About in the footer; stacks vertically in the collapsed rail, which
 * is too narrow for the two side by side.
 */
export function ThemeToggle({ collapsed }: ThemeToggleProps): ReactElement {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={`flex w-fit shrink-0 rounded-full border border-line bg-panel p-0.5 ${collapsed ? "flex-col" : ""}`}
    >
      {OPTIONS.map(({ theme: optionTheme, label, icon: Icon }) => {
        const selected = theme === optionTheme;
        return (
          <label
            key={optionTheme}
            data-tooltip={label}
            className={`flex h-8 w-9 cursor-pointer items-center justify-center rounded-full transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-blue-400 ${
              selected ? "bg-blue-600/25 text-fg" : "text-fg-subtle hover:text-fg"
            }`}
          >
            <input
              type="radio"
              name="theme"
              value={optionTheme}
              checked={selected}
              onChange={() => setTheme(optionTheme)}
              aria-label={label}
              className="sr-only"
            />
            <Icon className="h-4 w-4" />
          </label>
        );
      })}
    </div>
  );
}
