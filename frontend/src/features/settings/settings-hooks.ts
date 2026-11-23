import { useCallback, useState } from "react";

import { useMe } from "@/features/auth/me-query";

/** Only the owner (titular) changes the firm's settings; the backend enforces the same rule. */
export function useCanEditSettings(): boolean {
  const { data: me } = useMe();
  return me?.role === "OWNER";
}

/**
 * The last change that went through, for a polite live region ("Guardado: …"). Screen readers
 * hear it, and it stays on screen so the result does not depend on catching a toast.
 */
export function useAnnouncement() {
  const [message, setMessage] = useState<string | null>(null);
  const announce = useCallback((next: string | null) => setMessage(next), []);
  return [message, announce] as const;
}
