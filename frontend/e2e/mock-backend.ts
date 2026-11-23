import type { Page, Route } from "@playwright/test";

import type { AgendaItem, DetaineeAlert } from "../src/features/agenda/agenda-types";
import type { CaseView } from "../src/features/cases/case-types";
import { agendaFor } from "../src/test/agenda-fixtures";
import {
  CASES,
  CATALOGS,
  casePageFor,
  DETAILS,
  HEARINGS_BY_CASE,
  MEASURES,
} from "../src/test/case-fixtures";
import type { CatalogItem, CatalogView } from "../src/features/catalogs/catalog-types";
import type { DeadlineView } from "../src/features/deadlines/deadline-types";
import type {
  CustomField,
  CustomFieldChange,
  DeadlineRule,
  DeadlineRuleSetting,
  NewCustomField,
} from "../src/features/settings/settings-types";
import { ALL_DEADLINES, caseDeadlines, upcomingDeadlines } from "../src/test/deadline-fixtures";
import {
  CASE_FIELDS,
  DEADLINE_RULES,
  DEFENDANT_FIELDS,
  SETTINGS_CATALOGS,
} from "../src/test/settings-fixtures";

/** Fictitious user of the fictitious demo firm (same as the Vitest fixtures). */
export const DEMO_ME = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "lucia.ejemplo@example.com",
  displayName: "Lucía Ejemplo",
  role: "OWNER",
  twoFactorEnabled: true,
  tenant: {
    id: "00000000-0000-4000-8000-0000000000aa",
    name: "Estudio Demo (ficticio)",
    slug: "estudio-demo",
  },
};

export const TOTP_CODE = "246810";

interface MockBackendOptions {
  /** Start with a session already open. */
  signedIn?: boolean;
  /** The account asks for a TOTP code after the password. */
  secondFactor?: boolean;
  /** Hearings the agenda serves (filtered by range and lawyer); empty by default. */
  hearings?: AgendaItem[];
  /** Detainee alerts; none by default. */
  detaineeAlerts?: DetaineeAlert[];
  /** The agenda answers 500, to show its error state. */
  agendaFails?: boolean;
  /** Cases the search serves (filtered and paged); the fictitious fixtures by default. */
  cases?: CaseView[];
  /** The case search answers 500, to show its error state. */
  casesFail?: boolean;
  /** Deadlines `/plazos` serves (filtered by horizon); the fictitious fixtures by default. */
  deadlines?: DeadlineView[];
  /** The upcoming deadlines answer 500, to show their error state. */
  deadlinesFail?: boolean;
}

/**
 * The settings endpoints (T25) over the fictitious fixtures, with state so a change shows up in
 * the next GET. Undefined when the request is not one of them.
 */
function settingsBackend() {
  const catalogs: CatalogView[] = structuredClone(SETTINGS_CATALOGS);
  const fields: CustomField[] = structuredClone([...CASE_FIELDS, ...DEFENDANT_FIELDS]);
  const rules: DeadlineRule[] = structuredClone(DEADLINE_RULES);
  let next = 100;

  return (method: string, url: URL, body: () => unknown): { status: number; json?: unknown } | undefined => {
    const path = url.pathname;
    if (method === "GET" && path === "/api/v1/catalogs") return { status: 200, json: catalogs };
    if (method === "GET" && path === "/api/v1/custom-fields") {
      const entity = url.searchParams.get("entity");
      return { status: 200, json: fields.filter((field) => field.entity === entity) };
    }
    if (method === "GET" && path === "/api/v1/deadline-rules") return { status: 200, json: rules };

    const itemChange = /^\/api\/v1\/catalogs\/([a-z-]+)\/items\/([a-z0-9-]+)$/.exec(path);
    if (method === "PUT" && itemChange) {
      const item = catalogs
        .find((view) => view.catalog === itemChange[1])
        ?.items.find((candidate) => candidate.code === itemChange[2]);
      if (!item) return { status: 404 };
      const change = body() as { name: string | null; hidden: boolean };
      item.name = change.name ?? item.sourceName ?? item.name;
      item.hidden = change.hidden;
      return { status: 200, json: item };
    }
    const newItem = /^\/api\/v1\/catalogs\/([a-z-]+)\/items$/.exec(path);
    if (method === "POST" && newItem) {
      const view = catalogs.find((candidate) => candidate.catalog === newItem[1]);
      if (!view) return { status: 404 };
      const { name, article } = body() as { name: string; article: string | null };
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
      return { status: 201, json: added };
    }

    if (method === "POST" && path === "/api/v1/custom-fields") {
      const request = body() as NewCustomField;
      const created: CustomField = {
        ...request,
        id: `00000000-0000-4000-e000-${String(next++).padStart(12, "0")}`,
        key: `campo-${next}`,
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
      return { status: 201, json: created };
    }
    const fieldPath = /^\/api\/v1\/custom-fields\/([0-9a-f-]+)(?:\/(archive|restore))?$/.exec(path);
    if (fieldPath && method !== "GET") {
      const field = fields.find((candidate) => candidate.id === fieldPath[1]);
      if (!field) return { status: 404 };
      if (method === "POST" && fieldPath[2]) {
        field.archived = fieldPath[2] === "archive";
        return { status: 204 };
      }
      if (method === "PUT") {
        const change = body() as CustomFieldChange;
        Object.assign(field, {
          label: change.label,
          required: change.required,
          position: change.position,
          options: change.options.map((option, index) => ({
            code: option.code ?? `nueva-${index + 1}`,
            label: option.label,
            hidden: option.hidden,
          })),
        });
        return { status: 200, json: field };
      }
    }

    const ruleSetting = /^\/api\/v1\/deadline-rules\/([a-z0-9-]+)\/settings$/.exec(path);
    if (method === "PUT" && ruleSetting) {
      const rule = rules.find((candidate) => candidate.code === ruleSetting[1]);
      if (!rule) return { status: 404 };
      Object.assign(rule, body() as DeadlineRuleSetting);
      return { status: 200, json: rule };
    }
    return undefined;
  };
}

/**
 * A case detail, its hearings, a defendant's coercive measures or a catalog, from the
 * fixtures; undefined when there is no such resource (the caller answers 404).
 */
function caseResource(path: string): unknown {
  const catalog = /^\/api\/v1\/catalogs\/([a-z-]+)$/.exec(path)?.[1];
  if (catalog) return Object.values(CATALOGS).find((view) => view.catalog === catalog);
  const deadlines = /^\/api\/v1\/cases\/([^/]+)\/deadlines$/.exec(path)?.[1];
  if (deadlines) {
    return DETAILS.some((detail) => detail.id === deadlines) ? caseDeadlines(deadlines) : undefined;
  }
  const hearings = /^\/api\/v1\/cases\/([^/]+)\/hearings$/.exec(path)?.[1];
  if (hearings) {
    return DETAILS.some((detail) => detail.id === hearings)
      ? (HEARINGS_BY_CASE[hearings] ?? [])
      : undefined;
  }
  const caseId = /^\/api\/v1\/cases\/([^/]+)$/.exec(path)?.[1];
  if (caseId) return DETAILS.find((detail) => detail.id === caseId);
  const defendantId = /^\/api\/v1\/defendants\/([^/]+)\/coercive-measures$/.exec(path)?.[1];
  if (defendantId) return MEASURES[defendantId] ?? [];
  return undefined;
}

/**
 * A stateful stand-in for the auth endpoints, served with page.route so the e2e suite does not
 * need the backend. Checks the CSRF header on writes like the real one does.
 */
export async function mockBackend(page: Page, options: MockBackendOptions = {}) {
  const state = { signedIn: options.signedIn ?? false, pendingSecondFactor: false };
  const calls: string[] = [];
  const settings = settingsBackend();

  const problem = (route: Route, status: number, type: string) =>
    route.fulfill({
      status,
      contentType: "application/problem+json",
      body: JSON.stringify({ type: `/problems/${type}`, status }),
    });

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    calls.push(`${method} ${path}`);

    if (method !== "GET" && request.headers()["x-xsrf-token"] !== "e2e-token") {
      return problem(route, 403, "access-denied");
    }

    switch (`${method} ${path}`) {
      case "GET /api/v1/auth/csrf":
        return route.fulfill({
          status: 204,
          headers: { "Set-Cookie": "XSRF-TOKEN=e2e-token; Path=/; SameSite=Lax" },
        });
      case "GET /api/v1/me":
        return state.signedIn
          ? route.fulfill({ status: 200, json: DEMO_ME })
          : problem(route, 401, "authentication-required");
      case "POST /api/v1/auth/login": {
        const body = request.postDataJSON() as { tenant: string; email: string; password: string };
        if (body.tenant !== DEMO_ME.tenant.slug || body.email !== DEMO_ME.email) {
          return problem(route, 401, "invalid-credentials");
        }
        if (options.secondFactor) {
          state.pendingSecondFactor = true;
          return route.fulfill({ status: 202, json: { status: "SECOND_FACTOR_REQUIRED" } });
        }
        state.signedIn = true;
        return route.fulfill({ status: 204 });
      }
      case "POST /api/v1/auth/login/second-factor": {
        const { code } = request.postDataJSON() as { code: string };
        if (!state.pendingSecondFactor || code !== TOTP_CODE) {
          return problem(route, 401, "invalid-second-factor");
        }
        state.pendingSecondFactor = false;
        state.signedIn = true;
        return route.fulfill({ status: 204 });
      }
      case "POST /api/v1/auth/logout":
        state.signedIn = false;
        return route.fulfill({ status: 204 });
      case "GET /api/v1/agenda": {
        if (!state.signedIn) return problem(route, 401, "authentication-required");
        if (options.agendaFails) return problem(route, 500, "internal");
        const query = url.searchParams;
        return route.fulfill({
          status: 200,
          json: agendaFor(
            options.hearings ?? [],
            query.get("from") ?? "",
            query.get("to") ?? "",
            query.get("lawyerId"),
          ),
        });
      }
      case "GET /api/v1/detainee-alerts":
        if (!state.signedIn) return problem(route, 401, "authentication-required");
        return route.fulfill({ status: 200, json: options.detaineeAlerts ?? [] });
      case "GET /api/v1/cases": {
        if (!state.signedIn) return problem(route, 401, "authentication-required");
        if (options.casesFail) return problem(route, 500, "internal");
        const query = url.searchParams;
        return route.fulfill({
          status: 200,
          json: casePageFor(options.cases ?? CASES, {
            q: query.get("q"),
            includeArchived: query.get("includeArchived") === "true",
            page: Number(query.get("page") ?? 0),
            size: Number(query.get("size") ?? 20),
          }),
        });
      }
      case "GET /api/v1/deadlines": {
        if (!state.signedIn) return problem(route, 401, "authentication-required");
        if (options.deadlinesFail) return problem(route, 500, "internal");
        return route.fulfill({
          status: 200,
          json: upcomingDeadlines(
            Number(url.searchParams.get("withinDays") ?? 30),
            options.deadlines ?? ALL_DEADLINES,
          ),
        });
      }
      default: {
        const settingsAnswer = state.signedIn
          ? settings(method, url, () => request.postDataJSON())
          : undefined;
        if (settingsAnswer) {
          return settingsAnswer.status === 404
            ? problem(route, 404, "not-found")
            : route.fulfill({ status: settingsAnswer.status, json: settingsAnswer.json });
        }
        if (method === "GET" && state.signedIn) {
          const found = caseResource(path);
          if (found !== undefined) return route.fulfill({ status: 200, json: found });
        }
        return problem(route, 404, "not-found");
      }
    }
  });

  return { state, calls };
}
