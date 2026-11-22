import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { logout } from "@/features/auth/auth-api";
import { ME_QUERY_KEY } from "@/features/auth/me-query";
import { LOGIN_PATH } from "@/features/auth/redirect";
import { isUnauthorized } from "@/lib/api";

interface LogoutOptions {
  /** Firm slug to prefill on the login (switching firm). Empty: a blank login. */
  estudio?: string;
  /** Runs once the server session is closed, before leaving (e.g. forget the firm). */
  onSignedOut?: () => void;
}

/**
 * Closes the session on the server, drops every cached answer and opens the login.
 * If the server cannot be reached the user stays where they are and sees the error: we never
 * pretend a session was closed when it was not.
 */
export function useLogout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (options: LogoutOptions = {}) => {
      try {
        await logout();
      } catch (error) {
        // Already signed out (expired session): that is the state we wanted.
        if (!isUnauthorized(error)) throw error;
      }
      return options;
    },
    onSuccess: async (options) => {
      options.onSignedOut?.();
      // Signed out before leaving: no query of the shell may refetch, get a 401 and send the
      // next person on this device back to this user's page (session-expiry.ts).
      await queryClient.cancelQueries();
      queryClient.setQueryData(ME_QUERY_KEY, null);
      await navigate({
        to: LOGIN_PATH,
        search: options.estudio ? { estudio: options.estudio } : {},
      });
      // The shell is gone now: drop everything else the previous user loaded.
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== ME_QUERY_KEY[0] });
      queryClient.getMutationCache().clear();
    },
  });
}
