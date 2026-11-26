import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  calculateFee,
  createJusValue,
  fetchFeeScale,
  fetchJusValues,
  setJusValueArchived,
} from "@/features/fees/fee-api";
import type { CalculationRequest, JusValueData } from "@/features/fees/fee-types";

const FEES_KEY = "fees";

/** The scale ships with the jurisdiction package and only changes with a deploy. */
export function useFeeScale() {
  return useQuery({
    queryKey: [FEES_KEY, "scale"] as const,
    queryFn: ({ signal }) => fetchFeeScale(signal),
    staleTime: Infinity,
  });
}

export function useJusValues(includeArchived = false) {
  return useQuery({
    queryKey: [FEES_KEY, "jus-values", includeArchived] as const,
    queryFn: ({ signal }) => fetchJusValues(includeArchived, signal),
    // Showing the archived ones keeps the list (and its "Deshacé" rows) on screen meanwhile.
    placeholderData: keepPreviousData,
  });
}

function useInvalidateJusValues() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: [FEES_KEY, "jus-values"] });
}

export function useCreateJusValue() {
  const invalidate = useInvalidateJusValues();
  return useMutation({
    mutationFn: (data: JusValueData) => createJusValue(data),
    onSuccess: invalidate,
  });
}

export function useSetJusValueArchived() {
  const invalidate = useInvalidateJusValues();
  return useMutation({
    mutationFn: (variables: { id: string; archived: boolean }) =>
      setJusValueArchived(variables.id, variables.archived),
    onSuccess: invalidate,
  });
}

/** A calculation is a POST that stores nothing: the screen keeps the last answer. */
export function useCalculateFee() {
  return useMutation({
    mutationFn: (request: CalculationRequest) => calculateFee(request),
  });
}
