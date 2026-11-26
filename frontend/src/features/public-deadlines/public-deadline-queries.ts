import { useMutation, useQuery } from "@tanstack/react-query";

import {
  calculatePublicDeadline,
  fetchPublicRules,
} from "@/features/public-deadlines/public-deadline-api";
import type { PublicCalculationRequest } from "@/features/public-deadlines/public-deadline-types";

/** The rules ship with the jurisdiction package and only change with a deploy. */
export function usePublicRules() {
  return useQuery({
    queryKey: ["public", "deadline-rules"] as const,
    queryFn: ({ signal }) => fetchPublicRules(signal),
    staleTime: Infinity,
  });
}

/** A calculation is asked for on submit and stores nothing: the screen keeps the last answer. */
export function usePublicCalculation() {
  return useMutation({
    mutationFn: (request: PublicCalculationRequest) => calculatePublicDeadline(request),
  });
}
