import { createContext, useContext } from "react";

/**
 * Opens the edit form of a hearing. Provided by the screens that own the form (the agenda), so
 * the hearing cards deep in the day rail can offer "Editá" without passing a callback down.
 * Null where hearings are read only.
 */
export const HearingEditContext = createContext<((hearingId: string) => void) | null>(null);

export function useHearingEdit() {
  return useContext(HearingEditContext);
}
