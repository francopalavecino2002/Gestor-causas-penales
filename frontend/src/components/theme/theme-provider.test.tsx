import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { THEME_STORAGE_KEY } from "@/components/theme/theme-context";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { ThemeToggle } from "@/components/theme/theme-toggle";

/** Fakes `prefers-color-scheme: dark` and lets the test flip it like the OS would. */
function mockSystemTheme(initiallyDark: boolean) {
  let matches = initiallyDark;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      get matches() {
        return matches;
      },
      media: query,
      addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) =>
        listeners.add(listener),
      removeEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) =>
        listeners.delete(listener),
    })),
  );
  return {
    change(dark: boolean) {
      matches = dark;
      act(() =>
        listeners.forEach((listener) => listener({ matches: dark } as MediaQueryListEvent)),
      );
    },
  };
}

function renderToggle() {
  return render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>,
  );
}

const html = () => document.documentElement;

describe("ThemeProvider", () => {
  it("follows the system by default", () => {
    mockSystemTheme(true);
    renderToggle();

    expect(screen.getByRole("group", { name: "Tema" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Según el sistema" })).toBeChecked();
    expect(html()).toHaveClass("dark");
    expect(html().style.colorScheme).toBe("dark");
  });

  it("reacts when the system preference changes while following it", () => {
    const system = mockSystemTheme(false);
    renderToggle();
    expect(html()).not.toHaveClass("dark");

    system.change(true);
    expect(html()).toHaveClass("dark");

    system.change(false);
    expect(html()).not.toHaveClass("dark");
  });

  it("applies and remembers an explicit choice over the system", () => {
    const system = mockSystemTheme(false);
    renderToggle();

    fireEvent.click(screen.getByRole("radio", { name: "Oscuro" }));
    expect(html()).toHaveClass("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");

    fireEvent.click(screen.getByRole("radio", { name: "Claro" }));
    expect(html()).not.toHaveClass("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");

    system.change(true);
    expect(html()).not.toHaveClass("dark");
  });

  it("restores the saved choice on the next visit", () => {
    mockSystemTheme(false);
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    renderToggle();

    expect(screen.getByRole("radio", { name: "Oscuro" })).toBeChecked();
    expect(html()).toHaveClass("dark");
  });

  it("ignores an unknown saved value and falls back to the system", () => {
    mockSystemTheme(false);
    window.localStorage.setItem(THEME_STORAGE_KEY, "sepia");
    renderToggle();

    expect(screen.getByRole("radio", { name: "Según el sistema" })).toBeChecked();
  });

  it("keeps working when storage is blocked", () => {
    mockSystemTheme(false);
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    renderToggle();
    fireEvent.click(screen.getByRole("radio", { name: "Oscuro" }));
    expect(html()).toHaveClass("dark");

    getItem.mockRestore();
    setItem.mockRestore();
  });

  it("defaults to light when matchMedia is not available", () => {
    vi.stubGlobal("matchMedia", undefined);
    renderToggle();

    expect(html()).not.toHaveClass("dark");
  });
});
