import { queryOptions, useQuery } from "@tanstack/react-query";

import { fetchMe } from "@/features/auth/auth-api";

export const ME_QUERY_KEY = ["me"] as const;

/** The session user. `null` means signed out; route guards read it with ensureQueryData. */
export const meQueryOptions = queryOptions({
  queryKey: ME_QUERY_KEY,
  queryFn: fetchMe,
  staleTime: 5 * 60_000,
});

export function useMe() {
  return useQuery(meQueryOptions);
}
