import type { RefObject } from "react";

/**
 * Asked before a two-factor dialog closes: true when it must stay open. Set while a request runs
 * (holdOpen) and while the recovery codes are on screen and not saved (the codes panel); the dialog
 * reads it for "Cerrar", Escape and a tap outside.
 */
export type CloseGuard = RefObject<(() => boolean) | null>;

/**
 * Keeps the dialog open while a request runs: closing mid-request would let the server turn
 * two-factor on or replace the codes without the codes ever reaching the screen. Set it before
 * sending and call the returned function when the request settles; it only clears its own block,
 * so a guard the next step already set (the codes panel) stays.
 */
export function holdOpen(closeGuardRef: CloseGuard): () => void {
  const block = () => true;
  closeGuardRef.current = block;
  return () => {
    if (closeGuardRef.current === block) closeGuardRef.current = null;
  };
}
