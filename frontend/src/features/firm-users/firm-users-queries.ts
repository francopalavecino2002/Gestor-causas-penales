import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import type { Role } from "@/features/auth/auth-api";
import { ME_QUERY_KEY } from "@/features/auth/me-query";
import {
  archiveFirmUser,
  changeFirmUserRole,
  createFirmUser,
  fetchFirmUsers,
  resetFirmUserPassword,
  restoreFirmUser,
} from "@/features/firm-users/firm-users-api";
import { firmMembersQueryOptions } from "@/features/members/member-queries";
import { isApiError } from "@/lib/api";

export const FIRM_USERS_KEY = ["firm-users"] as const;

/** Owner only: the other roles get 403, so only the owner's screen asks. */
export function useFirmUsers() {
  return useQuery({
    queryKey: FIRM_USERS_KEY,
    queryFn: ({ signal }) => fetchFirmUsers(signal),
  });
}

/**
 * A change went through, or the server says the screen is behind (409, 404): read the list again,
 * the members the forms offer (names and roles) and /me, in case the owner's own state moved.
 */
function refreshUsers(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: FIRM_USERS_KEY }),
    queryClient.invalidateQueries({ queryKey: firmMembersQueryOptions.queryKey }),
    queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY }),
  ]);
}

function refreshWhenBehind(queryClient: QueryClient) {
  return (error: unknown) => {
    if (isApiError(error) && (error.status === 409 || error.status === 404)) {
      void refreshUsers(queryClient);
    }
  };
}

// The create and reset answers carry a temporary password: `gcTime: 0` drops them from the
// mutation cache as soon as nobody observes them, and the dialogs also reset the mutation once
// they have copied the password into their own state. The list is refetched, never patched with
// the answer, so the password never reaches the query cache.

export function useCreateFirmUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createFirmUser,
    gcTime: 0,
    onSuccess: () => refreshUsers(queryClient),
  });
}

export function useResetFirmUserPassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: resetFirmUserPassword,
    gcTime: 0,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FIRM_USERS_KEY }),
    onError: refreshWhenBehind(queryClient),
  });
}

export function useChangeFirmUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) => changeFirmUserRole(id, role),
    onSuccess: () => refreshUsers(queryClient),
    onError: refreshWhenBehind(queryClient),
  });
}

export function useArchiveFirmUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, archive }: { id: string; archive: boolean }) =>
      archive ? archiveFirmUser(id) : restoreFirmUser(id),
    onSuccess: () => refreshUsers(queryClient),
    onError: refreshWhenBehind(queryClient),
  });
}
