import type {
  PracticeArea,
  PracticeAreaOption,
} from "@/features/practice-areas/practice-area-types";
import { apiFetch } from "@/lib/api";

/** The areas the firm works in, the default one first. */
export function fetchPracticeAreas(signal?: AbortSignal): Promise<PracticeArea[]> {
  return apiFetch<PracticeArea[]>("/api/v1/practice-areas", { signal });
}

/** Every area of the firm's jurisdiction package, with whether it is on. */
export function fetchAvailablePracticeAreas(signal?: AbortSignal): Promise<PracticeAreaOption[]> {
  return apiFetch<PracticeAreaOption[]>("/api/v1/practice-areas/available", { signal });
}

/** Owner only: turns on exactly these areas. An area with active cases cannot be turned off. */
export function replaceEnabledPracticeAreas(codes: string[]): Promise<PracticeAreaOption[]> {
  return apiFetch<PracticeAreaOption[]>("/api/v1/practice-areas/enabled", {
    method: "PUT",
    body: { codes },
  });
}
