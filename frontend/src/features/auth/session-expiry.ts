import type { QueryClient } from "@tanstack/react-query";

import { ME_QUERY_KEY } from "@/features/auth/me-query";
import { LOGIN_PATH, loginSearchFor } from "@/features/auth/redirect";
import { isUnauthorized } from "@/lib/api";
import type { AppRouter } from "@/router";

/**
 * When any query or mutation answers 401 the session is gone (expired, signed out in another
 * tab): forget the user and open the login, keeping the current page to come back to.
 * Returns the unsubscribe function.
 */
export function redirectToLoginOnUnauthorized(queryClient: QueryClient, router: AppRouter) {
  const handle = (error: unknown) => {
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
