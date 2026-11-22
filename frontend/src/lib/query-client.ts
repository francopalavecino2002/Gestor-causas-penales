import { QueryClient } from "@tanstack/react-query";

import { isApiError } from "@/lib/api";

/** Client errors (4xx) will not change on a retry; network and server errors might. */
function shouldRetry(failureCount: number, error: unknown) {
  if (isApiError(error) && error.status >= 400 && error.status < 500) return false;
  return failureCount < 1;
}

/** Creates the app-wide TanStack Query client with conservative defaults. */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: shouldRetry,
        refetchOnWindowFocus: false,
      },
    },
  });
}
