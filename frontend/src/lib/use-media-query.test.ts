import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useMediaQuery } from "@/lib/use-media-query";

/** A `matchMedia` whose answer the test changes, notifying the listeners like a browser. */
function stubMatchMedia(initial: boolean) {
  let matches = initial;
  const listeners = new Set<() => void>();
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      get matches() {
        return matches;
      },
      addEventListener: (_: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
    })),
  );
  return {
    listeners,
    set(next: boolean) {
      matches = next;
      for (const listener of listeners) listener();
    },
  };
}

describe("useMediaQuery", () => {
  it("follows the query as it starts and stops matching", () => {
    const media = stubMatchMedia(false);
    const { result, unmount } = renderHook(() => useMediaQuery("(min-width: 80rem)"));
    expect(result.current).toBe(false);
    expect(window.matchMedia).toHaveBeenCalledWith("(min-width: 80rem)");

    act(() => media.set(true));
    expect(result.current).toBe(true);

    unmount();
    expect(media.listeners.size).toBe(0);
  });

  it("answers false where matchMedia does not exist", () => {
    vi.stubGlobal("matchMedia", undefined);
    const { result } = renderHook(() => useMediaQuery("(min-width: 80rem)"));
    expect(result.current).toBe(false);
  });
});
