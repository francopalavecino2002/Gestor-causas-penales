import type { CatalogItem, CatalogView } from "@/features/catalogs/catalog-types";
import type {
  CustomField,
  CustomFieldChange,
  DeadlineRule,
  DeadlineRuleSetting,
  NewCustomField,
} from "@/features/settings/settings-types";
import { json, noContent, problem, type RecordedRequest } from "@/test/mock-api";
import {
  CASE_FIELDS,
  DEADLINE_RULES,
  DEFENDANT_FIELDS,
  SETTINGS_CATALOGS,
} from "@/test/settings-fixtures";

type Handler = (request: RecordedRequest) => Response | Promise<Response>;

/**
 * The settings endpoints over the fictitious fixtures, with state: a change shows up in the next
 * GET, like the real backend. Writes without the CSRF header answer 403.
 */
export function settingsRoutes() {
  const catalogs: CatalogView[] = structuredClone(SETTINGS_CATALOGS);
  const fields: CustomField[] = structuredClone([...CASE_FIELDS, ...DEFENDANT_FIELDS]);
  const rules: DeadlineRule[] = structuredClone(DEADLINE_RULES);
  let next = 100;

  const csrf =
    (handler: Handler): Handler =>
    (request) =>
      request.headers["x-xsrf-token"] ? handler(request) : problem(403, "access-denied");

  const routes: Record<string, Handler> = {
    "GET /api/v1/catalogs": () => json(200, catalogs),
    "GET /api/v1/custom-fields": ({ query }) =>
      json(
        200,
        fields.filter((field) => field.entity === query.entity),
      ),
    "POST /api/v1/custom-fields": csrf(({ body }) => {
      const request = body as NewCustomField;
      const created: CustomField = {
        id: `00000000-0000-4000-e000-${String(next++).padStart(12, "0")}`,
        entity: request.entity,
        key: request.label.toLowerCase().replace(/\s+/g, "-"),
        label: request.label,
        type: request.type,
        required: request.required,
        position: fields.filter((field) => field.entity === request.entity).length,
        options: request.options.map((option, index) => ({
          code: `opcion-${index + 1}`,
          label: option.label,
          hidden: false,
        })),
        archived: false,
        createdAt: "2026-11-23T13:20:00Z",
      };
      fields.push(created);
      return json(201, created);
    }),
    "GET /api/v1/deadline-rules": () => json(200, rules),
  };

  for (const view of catalogs) {
    routes[`POST /api/v1/catalogs/${view.catalog}/items`] = csrf(({ body }) => {
      const { name, article } = body as { name: string; article: string | null };
      const added: CatalogItem = {
        code: `custom-${next++}`,
        name,
        sourceName: null,
        article,
        flags: [],
        note: null,
        origin: "FIRM",
        hidden: false,
      };
      view.items.push(added);
      return json(201, added);
    });
    for (const item of view.items) {
      routes[`PUT /api/v1/catalogs/${view.catalog}/items/${item.code}`] = csrf(({ body }) => {
        const change = body as { name: string | null; hidden: boolean };
        item.name = change.name ?? item.sourceName ?? item.name;
        item.hidden = change.hidden;
        return json(200, item);
      });
    }
  }

  for (const field of fields) {
    routes[`PUT /api/v1/custom-fields/${field.id}`] = csrf(({ body }) => {
      const change = body as CustomFieldChange;
      field.label = change.label;
      field.required = change.required;
      field.position = change.position;
      field.options = change.options.map((option, index) => ({
        code: option.code ?? `nueva-${index + 1}`,
        label: option.label,
        hidden: option.hidden,
      }));
      return json(200, field);
    });
    routes[`POST /api/v1/custom-fields/${field.id}/archive`] = csrf(() => {
      field.archived = true;
      return noContent();
    });
    routes[`POST /api/v1/custom-fields/${field.id}/restore`] = csrf(() => {
      field.archived = false;
      return noContent();
    });
  }

  for (const rule of rules) {
    routes[`PUT /api/v1/deadline-rules/${rule.code}/settings`] = csrf(({ body }) => {
      const setting = body as DeadlineRuleSetting;
      rule.enabled = setting.enabled;
      rule.alertDaysBefore = setting.alertDaysBefore;
      return json(200, rule);
    });
  }

  return { routes, catalogs, fields, rules };
}
