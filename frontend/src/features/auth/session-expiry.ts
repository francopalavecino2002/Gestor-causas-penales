import type { QueryClient } from "@tanstack/react-query";

import type { Me } from "@/features/auth/auth-api";
import { ME_QUERY_KEY } from "@/features/auth/me-query";
import { LOGIN_PATH, loginSearchFor } from "@/features/auth/redirect";
import { isApiError, isUnauthorized } from "@/lib/api";
import type { AppRouter } from "@/router";

/** The user still has a temporary password: the server refuses everything but changing it. */
export const PASSWORD_CHANGE_REQUIRED = "password-change-required";

/**
 * Watches every query and mutation. A 401 means the session is gone (expired, signed out in
 * another tab): forget the user and open the login, keeping the current page to come back to.
 * A 403 `password-change-required` means the owner gave this user a temporary password since the
 * page loaded: mark /me so the shell swaps the app for the "Elegí tu contraseña" screen, and read
 * /me again to be sure. Returns the unsubscribe function.
 */
export function redirectToLoginOnUnauthorized(queryClient: QueryClient, router: AppRouter) {
  const handle = (error: unknown) => {
    if (isApiError(error) && error.type === PASSWORD_CHANGE_REQUIRED) {
      queryClient.setQueryData<Me | null>(ME_QUERY_KEY, (me) =>
        me ? { ...me, passwordChangeRequired: true } : me,
      );
      void queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
      return;
    }
    if (!isUnauthorized(error)) return;
    queryClient.setQueryData(ME_QUERY_KEY, null);
    const { pathname, href } = router.state.location;
    if (pathname === LOGIN_PATH) return;
    void router.navigate({ to: LOGIN_PATH, search: loginSearchFor(href), replace: true });
  };

  const unsubscribeQueries = queryClient.getQueryCache().subscribe((event) => {
    if (event.type === "updated" && event.action.type === "error") handle(event.action.error);
  });
  const unsubscribeMutations = queryClient.getMutationCache().subscribe((event) => {
    if (event.type === "updated" && event.action.type === "error") handle(event.action.error);
  });

  return () => {
    unsubscribeQueries();
    unsubscribeMutations();
  };
}
