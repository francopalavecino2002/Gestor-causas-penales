import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { ME_QUERY_KEY } from "@/features/auth/me-query";
import {
  confirmEnrollment,
  disableTwoFactor,
  fetchTwoFactorStatus,
  regenerateRecoveryCodes,
  startEnrollment,
} from "@/features/two-factor/two-factor-api";
import { isApiError } from "@/lib/api";

export const TWO_FACTOR_KEY = ["two-factor"] as const;

export function useTwoFactorStatus() {
  return useQuery({
    queryKey: TWO_FACTOR_KEY,
    queryFn: ({ signal }) => fetchTwoFactorStatus(signal),
  });
}

/** The status changed (here or in another tab): refresh it and the badge that reads /me. */
function refreshStatus(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: TWO_FACTOR_KEY }),
    queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY }),
  ]);
}

/** A 409 means the screen is behind the server: refresh what it shows. */
function refreshOnConflict(queryClient: QueryClient) {
  return (error: unknown) => {
    if (isApiError(error) && error.type === "two-factor-state") void refreshStatus(queryClient);
  };
}

// The answers below carry the secret or the recovery codes: `gcTime: 0` drops them from the
// mutation cache as soon as the screen stops observing, and the screens also reset the mutation
// once they have copied the answer into their own state.

export function useStartEnrollment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: startEnrollment,
    gcTime: 0,
    onError: refreshOnConflict(queryClient),
  });
}

export function useConfirmEnrollment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: confirmEnrollment,
    gcTime: 0,
    onSuccess: () => refreshStatus(queryClient),
    onError: refreshOnConflict(queryClient),
  });
}

export function useRegenerateRecoveryCodes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: regenerateRecoveryCodes,
    gcTime: 0,
    // Two-factor stays on, so /me (twoFactorEnabled) is unchanged: only the count of codes moves.
    // A 409 is different: it means it was turned off elsewhere, so it refreshes /me too.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TWO_FACTOR_KEY }),
    onError: refreshOnConflict(queryClient),
  });
}

export function useDisableTwoFactor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ password, code }: { password: string; code: string }) =>
      disableTwoFactor(password, code),
    gcTime: 0,
    onSuccess: () => refreshStatus(queryClient),
    onError: refreshOnConflict(queryClient),
  });
}
