import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ME_QUERY_KEY } from "@/features/auth/me-query";
import { uploadImport } from "@/features/imports/import-api";
import type { ImportKind } from "@/features/imports/import-types";

interface ImportVariables {
  kind: ImportKind;
  file: File;
}

/** Dry run: the server checks every row and saves nothing. */
export function usePreviewImport() {
  return useMutation({
    mutationFn: ({ kind, file }: ImportVariables) => uploadImport(kind, file, true),
  });
}

/**
 * The real import. Afterwards every cached list may be stale (cases, agenda, deadlines,
 * persons), so everything but the session is refreshed.
 */
export function useCommitImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, file }: ImportVariables) => uploadImport(kind, file, false),
    onSuccess: () =>
      queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] !== ME_QUERY_KEY[0],
      }),
  });
}
