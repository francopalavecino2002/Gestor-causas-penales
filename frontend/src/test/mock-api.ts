import { vi } from "vitest";

import { FIRM_TIME_ZONE } from "@/features/agenda/agenda-dates";
import type { Me } from "@/features/auth/auth-api";
import type { CaseDetail, CaseView } from "@/features/cases/case-types";
import type { DeadlineView } from "@/features/deadlines/deadline-types";
import {
  CASES,
  CATALOGS,
  casePageFor,
  DETAILS,
  HEARINGS_BY_CASE,
  MEASURES,
} from "@/test/case-fixtures";
import { areaCatalog, PENAL_AREA } from "@/test/area-fixtures";
import { ALL_DEADLINES, caseDeadlines, upcomingDeadlines } from "@/test/deadline-fixtures";
import { FORM_CATALOGS, MEMBERS } from "@/test/form-fixtures";
import { ALL_TASKS, tasksBackend } from "@/test/task-fixtures";
import type { TaskView } from "@/features/tasks/task-types";
import type { DeadlineAlert, NewsItem } from "@/features/news/news-types";
import { ALL_DUE_SOON, ALL_NEWS, newsBackend } from "@/test/news-fixtures";
import type { JusValueView } from "@/features/fees/fee-types";
import { ALL_JUS_VALUES, feesBackend } from "@/test/fee-fixtures";
import type { PublicRule } from "@/features/public-deadlines/public-deadline-types";
import { PUBLIC_RULES, publicDeadlineBackend } from "@/test/public-deadline-fixtures";
import type { ClientView, PersonListItem } from "@/features/persons/person-api";
import { personsBackend } from "@/test/person-fixtures";
import { twoFactorBackend } from "@/test/two-factor-fixtures";
import type { FirmUser } from "@/features/firm-users/firm-users-api";
import { FIRM_USERS, firmUsersBackend } from "@/test/firm-user-fixtures";

/** A request as the fake backend sees it. */
export interface RecordedRequest {
  method: string;
  path: string;
  /** Query string parameters, e.g. { from: "2026-11-23" }. */
  query: Record<string, string>;
  headers: Record<string, string>;
  body: unknown;
}

type Handler = (request: RecordedRequest) => Response | Promise<Response>;

export const noContent = () => new Response(null, { status: 204 });

export const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });

export const problem = (status: number, type: string, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify({ type: `/problems/${type}`, status, title: type }), {
    status,
    headers: { "Content-Type": "application/problem+json", ...headers },
  });

/** A problem+json answer with a detail and extension members (e.g. an import `report`). */
export const problemWith = (status: number, type: string, members: Record<string, unknown>) =>
  new Response(JSON.stringify({ type: `/problems/${type}`, status, title: type, ...members }), {
    status,
    headers: { "Content-Type": "application/problem+json" },
  });

/** Fictitious user of the fictitious demo firm. */
export const DEMO_ME: Me = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "lucia.ejemplo@example.com",
  displayName: "Lucía Ejemplo",
  role: "OWNER",
  twoFactorEnabled: false,
  passwordChangeRequired: false,
  tenant: {
    id: "00000000-0000-4000-8000-0000000000aa",
    name: "Estudio Demo (ficticio)",
    slug: "estudio-demo",
  },
};

export function clearCookies() {
  for (const cookie of document.cookie.split(";")) {
    const name = cookie.split("=")[0]?.trim();
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  }
}

/**
 * Replaces `fetch` with a table of handlers keyed by "METHOD /path". GET /api/v1/auth/csrf
 * sets an XSRF-TOKEN cookie unless overridden. Unknown routes answer 404 so a missing mock
 * fails loudly. Returns the list of requests, in order.
 */
export function mockFetch(routes: Record<string, Handler>) {
  const requests: RecordedRequest[] = [];
  const table: Record<string, Handler> = {
    "GET /api/v1/auth/csrf": () => {
      document.cookie = "XSRF-TOKEN=token-1; path=/";
      return noContent();
    },
    ...routes,
  };

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input), "http://localhost");
    const method = (init.method ?? "GET").toUpperCase();
    const headers = Object.fromEntries(
      Object.entries((init.headers ?? {}) as Record<string, string>).map(([key, value]) => [
        key.toLowerCase(),
        value,
      ]),
    );
    const request: RecordedRequest = {
      method,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      headers,
      body:
        typeof init.body === "string"
          ? JSON.parse(init.body)
          : init.body instanceof FormData
            ? init.body
            : undefined,
    };
    requests.push(request);
    const key = `${method} ${url.pathname}`;
    // "METHOD /prefix/*" keys answer every path under the prefix (e.g. ids created by a test).
    const handler =
      table[key] ??
      Object.entries(table).find(
        ([pattern]) => pattern.endsWith("*") && key.startsWith(pattern.slice(0, -1)),
      )?.[1];
    return handler ? handler(request) : problem(404, "not-found");
  });

  vi.stubGlobal("fetch", fetchMock);
  return requests;
}

/**
 * Signed-in session: /me answers the demo user, and the home (agenda) loads empty unless a test
 * passes its own agenda routes.
 */
export function signedIn(me: Me = DEMO_ME, routes: Record<string, Handler> = {}) {
  return mockFetch({
    "GET /api/v1/me": () => json(200, me),
    "GET /api/v1/me/two-factor": () =>
      json(200, {
        enabled: me.twoFactorEnabled,
        recoveryCodesRemaining: me.twoFactorEnabled ? 10 : 0,
      }),
    "GET /api/v1/agenda": ({ query }) =>
      json(200, {
        from: query.from,
        to: query.to,
        timeZone: FIRM_TIME_ZONE,
        items: [],
      }),
    "GET /api/v1/detainee-alerts": () => json(200, []),
    "GET /api/v1/cases": ({ query }) =>
      json(200, { items: [], page: Number(query.page ?? 0), size: 20, total: 0 }),
    "GET /api/v1/deadlines": () => json(200, []),
    "GET /api/v1/tasks": ({ query }) =>
      json(200, { items: [], page: Number(query.page ?? 0), size: 20, total: 0 }),
    "GET /api/v1/news": ({ query }) =>
      json(200, { dueSoon: [], items: [], page: Number(query.page ?? 0), size: 20, total: 0 }),
    "GET /api/v1/persons": ({ query }) =>
      json(200, { items: [], page: Number(query.page ?? 0), size: 20, total: 0 }),
    "GET /api/v1/users": () => json(200, MEMBERS),
    // The owner's users screen: only the owner, unless a test passes firmUserRoutes().
    "GET /api/v1/firm/users": () =>
      json(
        200,
        FIRM_USERS.filter((user) => user.id === me.id),
      ),
    "GET /api/v1/practice-areas": () => json(200, [PENAL_AREA]),
    // The optional AI assistance is off unless a test turns it on.
    "GET /api/v1/ai-assist": () =>
      json(200, { available: true, enabled: false, provider: "Google Gemini" }),
    ...catalogRoutes(),
    ...routes,
  });
}

/**
 * The catalogs the screens read, answered from the fictitious fixtures: the criminal ones, or the
 * civil ones for `?area=civil` (the circumscriptions are shared).
 */
export function catalogRoutes(): Record<string, Handler> {
  const criminal = [...Object.values(CATALOGS), ...FORM_CATALOGS];
  const ids = new Set([
    ...criminal.map((view) => view.catalog),
    "party-roles",
    "action-types",
    "represented-sides",
  ]);
  return Object.fromEntries(
    [...ids].map((id) => [
      `GET /api/v1/catalogs/${id}`,
      ({ query }: RecordedRequest) => {
        const view = areaCatalog(id, query.area, criminal);
        return view ? json(200, view) : problem(404, "catalog-not-found");
      },
    ]),
  );
}

/**
 * The case endpoints over the fictitious fixtures: the paged search, each detail, its hearings
 * and its defendants' coercive measures. Anything else answers 404, like the real backend.
 */
export function caseRoutes(
  options: { cases?: CaseView[]; details?: CaseDetail[] } = {},
): Record<string, Handler> {
  const cases = options.cases ?? CASES;
  const details = options.details ?? DETAILS;
  const routes: Record<string, Handler> = {
    "GET /api/v1/cases": ({ query }) =>
      json(
        200,
        casePageFor(cases, {
          q: query.q,
          includeArchived: query.includeArchived === "true",
          area: query.area,
          page: Number(query.page ?? 0),
          size: Number(query.size ?? 20),
        }),
      ),
  };
  for (const detail of details) {
    routes[`GET /api/v1/cases/${detail.id}`] = () => json(200, detail);
    routes[`GET /api/v1/cases/${detail.id}/hearings`] = () =>
      json(200, HEARINGS_BY_CASE[detail.id] ?? []);
    routes[`GET /api/v1/cases/${detail.id}/deadlines`] = () => json(200, caseDeadlines(detail.id));
    for (const defendant of detail.defendants) {
      routes[`GET /api/v1/defendants/${defendant.id}/coercive-measures`] = () =>
        json(200, MEASURES[defendant.id] ?? []);
    }
  }
  return routes;
}

/** `GET /api/v1/deadlines` over the fictitious deadlines, filtered by `withinDays`. */
export function deadlineRoutes(deadlines: DeadlineView[] = ALL_DEADLINES): Record<string, Handler> {
  return {
    "GET /api/v1/deadlines": ({ query }) =>
      json(200, upcomingDeadlines(Number(query.withinDays ?? 30), deadlines)),
  };
}

/**
 * `/api/v1/tasks` over the fictitious tasks, with state: a POST, PUT, done, reopen, archive or
 * restore shows up in the next GET.
 */
export function taskRoutes(tasks: TaskView[] = ALL_TASKS): Record<string, Handler> {
  const backend = tasksBackend(tasks, DEMO_ME.id);
  const answer = (request: RecordedRequest) => {
    const result = backend(request.method, request.path, request.query, () => request.body);
    if (!result) return problem(404, "not-found");
    if (result.status === 404) return problem(404, "not-found");
    return result.json === undefined ? noContent() : json(result.status, result.json);
  };
  const routes: Record<string, Handler> = {
    "GET /api/v1/tasks": answer,
    "POST /api/v1/tasks": answer,
  };
  for (const item of tasks) {
    routes[`PUT /api/v1/tasks/${item.id}`] = answer;
    for (const action of ["done", "reopen", "archive", "restore"]) {
      routes[`POST /api/v1/tasks/${item.id}/${action}`] = answer;
    }
  }
  return routes;
}

/**
 * `/api/v1/news` over the fictitious wall, with state: a new post, an archive or a restore shows
 * up in the next GET.
 */
export function newsRoutes(
  items: NewsItem[] = ALL_NEWS,
  dueSoon: DeadlineAlert[] = ALL_DUE_SOON,
): Record<string, Handler> {
  const backend = newsBackend(items, dueSoon);
  const answer = (request: RecordedRequest) => {
    const result = backend(request.method, request.path, request.query, () => request.body);
    if (!result) return problem(404, "not-found");
    if (result.status === 400) return problem(400, "invalid-post");
    if (result.status === 403) return problem(403, "access-denied");
    if (result.status === 404) return problem(404, "not-found");
    return result.json === undefined ? noContent() : json(result.status, result.json);
  };
  const routes: Record<string, Handler> = {
    "GET /api/v1/news": answer,
    "POST /api/v1/news/posts": answer,
  };
  for (const entry of items) {
    if (!entry.post) continue;
    routes[`POST /api/v1/news/posts/${entry.post.id}/archive`] = answer;
    routes[`POST /api/v1/news/posts/${entry.post.id}/restore`] = answer;
  }
  return routes;
}

/**
 * `/api/v1/fees` over the fictitious scale and JUS values, with state: a new value, an archive or
 * a restore shows up in the next GET; the calculation uses the chosen day's value.
 */
export function feeRoutes(
  values: JusValueView[] = ALL_JUS_VALUES,
  options: { today?: string; role?: string } = {},
): Record<string, Handler> {
  const backend = feesBackend(values, options);
  const answer = (request: RecordedRequest) => {
    const result = backend(request.method, request.path, request.query, () => request.body);
    if (!result) return problem(404, "not-found");
    if (result.problem) return problem(result.status, result.problem);
    return result.json === undefined ? noContent() : json(result.status, result.json);
  };
  const routes: Record<string, Handler> = {
    "GET /api/v1/fees/scale": answer,
    "GET /api/v1/fees/jus-values": answer,
    "POST /api/v1/fees/jus-values": answer,
    "POST /api/v1/fees/calculations": answer,
  };
  for (const value of values) {
    routes[`POST /api/v1/fees/jus-values/${value.id}/archive`] = answer;
    routes[`POST /api/v1/fees/jus-values/${value.id}/restore`] = answer;
  }
  return routes;
}

/**
 * `/api/v1/persons` and `/api/v1/clients` over the fictitious persons and clients, with state:
 * a create, an edit, an archive, a new client or contact shows up in the next GET.
 */
export function personRoutes(
  initial: { persons?: PersonListItem[]; clients?: ClientView[] } = {},
  options: { role?: string } = {},
): Record<string, Handler> {
  const backend = personsBackend(initial, options);
  const answer = (request: RecordedRequest) => {
    const result = backend(request.method, request.path, request.query, () => request.body);
    if (!result) return problem(404, "not-found");
    if (result.problem) return problemWith(result.status, result.problem, result.members ?? {});
    return result.json === undefined ? noContent() : json(result.status, result.json);
  };
  const routes: Record<string, Handler> = {};
  for (const method of ["GET", "POST", "PUT"]) {
    routes[`${method} /api/v1/persons`] = answer;
    routes[`${method} /api/v1/persons/*`] = answer;
    routes[`${method} /api/v1/clients/*`] = answer;
  }
  return routes;
}

/** The public calculator's two endpoints (anonymous) over the fictitious subset of rules. */
export function publicDeadlineRoutes(rules: PublicRule[] = PUBLIC_RULES): Record<string, Handler> {
  const backend = publicDeadlineBackend(rules);
  const answer = (request: RecordedRequest) => {
    const result = backend(request.path, request.query);
    if (!result) return problem(404, "not-found");
    if (result.problem) return problem(result.status, result.problem);
    return json(result.status, result.json);
  };
  return {
    "GET /api/v1/public/deadline-rules": answer,
    "GET /api/v1/public/deadline-calculation": answer,
  };
}

/**
 * `/api/v1/me/two-factor` over the stateful fictitious backend, and a `/me` whose
 * `twoFactorEnabled` follows it, so the badges update after turning it on or off.
 */
export function twoFactorRoutes(
  initial: Parameters<typeof twoFactorBackend>[0] = {},
  me: Me = DEMO_ME,
) {
  const backend = twoFactorBackend(initial);
  const answer = (request: RecordedRequest) => {
    const result = backend.answer(request.method, request.path, () => request.body);
    if (!result) return problem(404, "not-found");
    if (result.problem) return problem(result.status, result.problem, result.headers);
    return result.json === undefined ? noContent() : json(result.status, result.json);
  };
  const routes: Record<string, Handler> = {
    "GET /api/v1/me": () => json(200, { ...me, twoFactorEnabled: backend.state.enabled }),
    "GET /api/v1/me/two-factor": answer,
    "POST /api/v1/me/two-factor/*": answer,
  };
  return { routes, state: backend.state };
}

/**
 * `/api/v1/firm/users` over the stateful fictitious backend: a create, a role change, an archive,
 * a restore or a reset shows up in the next GET.
 */
export function firmUserRoutes(
  initial?: FirmUser[],
  options: Parameters<typeof firmUsersBackend>[1] = {},
) {
  const backend = firmUsersBackend(initial, options);
  const answer = (request: RecordedRequest) => {
    const result = backend.answer(request.method, request.path, () => request.body);
    if (!result) return problem(404, "not-found");
    if (result.problem) return problem(result.status, result.problem);
    return json(result.status, result.json);
  };
  const routes: Record<string, Handler> = {
    "GET /api/v1/firm/users": answer,
    "POST /api/v1/firm/users": answer,
    "PUT /api/v1/firm/users/*": answer,
    "POST /api/v1/firm/users/*": answer,
  };
  return { routes, users: backend.users };
}

/**
 * `POST /api/v1/me/password` like PasswordController: the current password must match, the new one
 * has at least 12 characters and differs; a 204 ends the session, so /me answers 401 afterwards.
 */
export function passwordRoutes(me: Me, currentPassword: string) {
  const state = { signedIn: true, changedTo: null as string | null };
  const routes: Record<string, Handler> = {
    "GET /api/v1/me": () =>
      state.signedIn ? json(200, me) : problem(401, "authentication-required"),
    "POST /api/v1/me/password": ({ body }) => {
      const change = body as { currentPassword: string; newPassword: string };
      if (change.currentPassword !== currentPassword) return problem(422, "invalid-confirmation");
      if (change.newPassword.length < 12) {
        return problemWith(400, "invalid-password", {
          detail: "Password must have at least 12 characters",
        });
      }
      if (change.newPassword === change.currentPassword) {
        return problemWith(400, "invalid-password", {
          detail: "The new password must be different from the current one",
        });
      }
      state.signedIn = false;
      state.changedTo = change.newPassword;
      return noContent();
    },
  };
  return { routes, state };
}

/** Anonymous session: /me answers 401. */
export function signedOut(routes: Record<string, Handler> = {}) {
  return mockFetch({
    "GET /api/v1/me": () => problem(401, "authentication-required"),
    ...routes,
  });
}
