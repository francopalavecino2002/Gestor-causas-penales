import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { AnyCatalogId } from "@/features/catalogs/catalog-types";
import { DEFAULT_AREA } from "@/features/practice-areas/practice-area-format";
import {
  addCatalogItem,
  archiveCustomField,
  changeDeadlineRuleSetting,
  createCustomField,
  fetchAllCatalogs,
  fetchCustomFields,
  fetchDeadlineRules,
  restoreCustomField,
  updateCatalogItem,
  updateCustomField,
} from "@/features/settings/settings-api";
import type {
  CustomFieldChange,
  CustomFieldEntity,
  DeadlineRule,
  DeadlineRuleSetting,
  NewCustomField,
} from "@/features/settings/settings-types";

const CATALOGS_KEY = ["settings", "catalogs"] as const;
const CUSTOM_FIELDS_KEY = ["custom-fields"] as const;
const DEADLINE_RULES_KEY = ["deadline-rules"] as const;

/** The catalogs of one practice area (the criminal one by default). */
export function useAllCatalogs(area: string = DEFAULT_AREA) {
  return useQuery({
    queryKey: [...CATALOGS_KEY, area] as const,
    queryFn: ({ signal }) => fetchAllCatalogs(area, signal),
  });
}

/**
 * After a catalog change: this screen's lists and the copy the case screens cache (every area:
 * a shared catalog such as the circumscriptions changes in all of them).
 */
function useCatalogInvalidation() {
  const queryClient = useQueryClient();
  return (catalog: AnyCatalogId) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: CATALOGS_KEY }),
      queryClient.invalidateQueries({ queryKey: ["catalog", catalog] }),
    ]);
}

export function useAddCatalogItem(catalog: AnyCatalogId, area: string = DEFAULT_AREA) {
  const invalidate = useCatalogInvalidation();
  return useMutation({
    mutationFn: (item: { name: string; article: string | null }) =>
      addCatalogItem(catalog, area, item),
    onSuccess: () => invalidate(catalog),
  });
}

export function useUpdateCatalogItem(catalog: AnyCatalogId, area: string = DEFAULT_AREA) {
  const invalidate = useCatalogInvalidation();
  return useMutation({
    mutationFn: (variables: { code: string; name: string | null; hidden: boolean }) =>
      updateCatalogItem(catalog, area, variables.code, {
        name: variables.name,
        hidden: variables.hidden,
      }),
    onSuccess: () => invalidate(catalog),
  });
}

export function useCustomFields(entity: CustomFieldEntity) {
  return useQuery({
    queryKey: [...CUSTOM_FIELDS_KEY, entity] as const,
    queryFn: ({ signal }) => fetchCustomFields(entity, signal),
  });
}

function useCustomFieldsInvalidation() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: CUSTOM_FIELDS_KEY });
}

export function useCreateCustomField() {
  const invalidate = useCustomFieldsInvalidation();
  return useMutation({
    mutationFn: (field: NewCustomField) => createCustomField(field),
    onSuccess: invalidate,
  });
}

export function useUpdateCustomField() {
  const invalidate = useCustomFieldsInvalidation();
  return useMutation({
    mutationFn: (variables: { id: string; change: CustomFieldChange }) =>
      updateCustomField(variables.id, variables.change),
    onSuccess: invalidate,
  });
}

/** Archive or restore: the same request shape, the same cache to refresh. */
export function useArchiveCustomField() {
  const invalidate = useCustomFieldsInvalidation();
  return useMutation({
    mutationFn: (variables: { id: string; archive: boolean }) =>
      variables.archive ? archiveCustomField(variables.id) : restoreCustomField(variables.id),
    onSuccess: invalidate,
  });
}

export function useDeadlineRules() {
  return useQuery({
    queryKey: DEADLINE_RULES_KEY,
    queryFn: ({ signal }) => fetchDeadlineRules(signal),
  });
}

/**
 * Puts the answered rule in the list right away, then refreshes the deadlines: a disabled rule
 * drops out of `/plazos` and a new warning window changes which ones "vencen pronto".
 */
export function useChangeDeadlineRuleSetting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { code: string; setting: DeadlineRuleSetting }) =>
      changeDeadlineRuleSetting(variables.code, variables.setting),
    onSuccess: (rule) => {
      queryClient.setQueryData<DeadlineRule[]>(DEADLINE_RULES_KEY, (rules) =>
        rules?.map((current) => (current.code === rule.code ? rule : current)),
      );
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: DEADLINE_RULES_KEY }),
        queryClient.invalidateQueries({ queryKey: ["deadlines"] }),
        queryClient.invalidateQueries({
          predicate: (query) => query.queryKey[0] === "case" && query.queryKey[2] === "deadlines",
        }),
      ]);
    },
  });
}
