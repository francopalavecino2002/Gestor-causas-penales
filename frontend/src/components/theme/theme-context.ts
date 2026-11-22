import { createContext, useContext } from "react";

/** What the user picked: a fixed theme or "follow the operating system". */
export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

/** localStorage key; index.html reads the same key before first paint to avoid a light flash. */
export const THEME_STORAGE_KEY = "theme";
export const DARK_QUERY = "(prefers-color-scheme: dark)";

const PREFERENCES: readonly ThemePreference[] = ["light", "dark", "system"];

export interface ThemeContextValue {
  theme: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemePreference) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Reads the saved preference. Storage can be blocked (private mode), so it never throws. */
export function readStoredTheme(): ThemePreference {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return PREFERENCES.includes(value as ThemePreference) ? (value as ThemePreference) : "system";
  } catch {
    return "system";
  }
}

export function storeTheme(theme: ThemePreference) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // The choice still applies for this visit; it is just not remembered.
  }
}

export function systemPrefersDark(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia(DARK_QUERY).matches;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used inside <ThemeProvider>");
  }
  return context;
}
