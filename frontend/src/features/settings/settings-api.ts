import type { AnyCatalogId, CatalogItem, CatalogView } from "@/features/catalogs/catalog-types";
import type {
  CustomField,
  CustomFieldChange,
  CustomFieldEntity,
  DeadlineRule,
  DeadlineRuleSetting,
  NewCustomField,
} from "@/features/settings/settings-types";
import { apiFetch } from "@/lib/api";

/** Every catalog of the firm, hidden items included: the settings screen manages them. */
export function fetchAllCatalogs(signal?: AbortSignal): Promise<CatalogView[]> {
  return apiFetch<CatalogView[]>("/api/v1/catalogs?includeHidden=true", { signal });
}

export function addCatalogItem(
  catalog: AnyCatalogId,
  item: { name: string; article: string | null },
): Promise<CatalogItem> {
  return apiFetch<CatalogItem>(`/api/v1/catalogs/${catalog}/items`, {
    method: "POST",
    body: item,
  });
}

/**
 * Renames and shows or hides an item. For a built-in item a null name, or the package's own,
 * restores the package name; the article never changes.
 */
export function updateCatalogItem(
  catalog: AnyCatalogId,
  code: string,
  change: { name: string | null; hidden: boolean },
): Promise<CatalogItem> {
  return apiFetch<CatalogItem>(`/api/v1/catalogs/${catalog}/items/${encodeURIComponent(code)}`, {
    method: "PUT",
    body: change,
  });
}

/** Archived fields included: the screen lists them apart so they can be restored. */
export function fetchCustomFields(
  entity: CustomFieldEntity,
  signal?: AbortSignal,
): Promise<CustomField[]> {
  return apiFetch<CustomField[]>(`/api/v1/custom-fields?entity=${entity}&includeArchived=true`, {
    signal,
  });
}

export function createCustomField(field: NewCustomField): Promise<CustomField> {
  return apiFetch<CustomField>("/api/v1/custom-fields", { method: "POST", body: field });
}

export function updateCustomField(id: string, change: CustomFieldChange): Promise<CustomField> {
  return apiFetch<CustomField>(`/api/v1/custom-fields/${id}`, { method: "PUT", body: change });
}

/** Nothing is deleted: an archived field keeps the values already stored. */
export function archiveCustomField(id: string): Promise<void> {
  return apiFetch(`/api/v1/custom-fields/${id}/archive`, { method: "POST" });
}

export function restoreCustomField(id: string): Promise<void> {
  return apiFetch(`/api/v1/custom-fields/${id}/restore`, { method: "POST" });
}

export function fetchDeadlineRules(signal?: AbortSignal): Promise<DeadlineRule[]> {
  return apiFetch<DeadlineRule[]>("/api/v1/deadline-rules", { signal });
}

export function changeDeadlineRuleSetting(
  code: string,
  setting: DeadlineRuleSetting,
): Promise<DeadlineRule> {
  return apiFetch<DeadlineRule>(`/api/v1/deadline-rules/${encodeURIComponent(code)}/settings`, {
    method: "PUT",
    body: setting,
  });
}
