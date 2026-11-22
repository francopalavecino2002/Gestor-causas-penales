import { useId } from "react";
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";

import { useTheme, type ThemePreference } from "@/components/theme/theme-context";
import { cn } from "@/lib/utils";

const OPTIONS: { value: ThemePreference; label: string; icon: LucideIcon }[] = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Oscuro", icon: Moon },
  { value: "system", label: "Según el sistema", icon: Monitor },
];

/**
 * Segmented control built on native radios: arrow keys move between options, the group has a
 * name for screen readers and each option keeps its word (icons are decorative).
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const name = useId();

  return (
    <fieldset className={cn("min-w-0", className)}>
      <legend className="sr-only">Tema</legend>
      <div className="inline-flex rounded-lg border bg-secondary p-0.75">
        {OPTIONS.map(({ value, label, icon: Icon }) => (
          <label
            key={value}
            className={cn(
              "relative inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-3 text-meta font-semibold whitespace-nowrap text-muted-foreground transition-colors duration-fast ease-out",
              "has-checked:bg-card has-checked:text-foreground has-checked:shadow-segment",
              "has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring",
            )}
          >
            <input
              type="radio"
              name={name}
              value={value}
              checked={theme === value}
              onChange={() => setTheme(value)}
              className="sr-only"
            />
            <Icon aria-hidden="true" className="hidden size-5 sm:block" />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
