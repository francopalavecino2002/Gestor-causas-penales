import { QueryClient } from "@tanstack/react-query";

/** Creates the app-wide TanStack Query client with conservative defaults. */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
}
