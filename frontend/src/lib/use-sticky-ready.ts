import { useState } from "react";

/**
 * True from the first time `ready` is true on: a form shows its skeleton only while it first
 * loads, and keeps its fields on screen when a later choice (another practice area) loads more
 * lists, so what the user typed and where they were stay put.
 */
export function useStickyReady(ready: boolean): boolean {
  const [once, setOnce] = useState(ready);
  if (ready && !once) setOnce(true);
  return once || ready;
}
