import { useCallback, useSyncExternalStore } from "react";

/**
 * Whether a media query matches now, following its changes. False where `matchMedia` does not
 * exist (jsdom): the phone layout. For layouts that need one element in a different place of the
 * DOM per width, where CSS alone would duplicate it or break the reading order.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window.matchMedia !== "function") return () => {};
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => typeof window.matchMedia === "function" && window.matchMedia(query).matches,
    () => false,
  );
}
