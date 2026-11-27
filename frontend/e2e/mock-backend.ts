import type { Page, Route } from "@playwright/test";

import type { AgendaItem, DetaineeAlert } from "../src/features/agenda/agenda-types";
import type { CalendarFeedStatus } from "../src/features/calendar-feed/calendar-feed-api";
import type { CaseView } from "../src/features/cases/case-types";
import { agendaFor } from "../src/test/agenda-fixtures";
import { CRIMINAL_CATALOGS, formsBackend } from "./forms-backend";
import {
  areaCatalog,
  availableAreas,
  CASE_CIVIL,
  CIVIL_CATALOGS,
  DETAIL_CIVIL,
} from "../src/test/area-fixtures";
import { CASES, casePageFor, DETAILS, HEARINGS_BY_CASE, MEASURES } from "../src/test/case-fixtures";
import type { CatalogItem, CatalogView } from "../src/features/catalogs/catalog-types";
import type { DeadlineView } from "../src/features/deadlines/deadline-types";
import type {
  CustomField,
  CustomFieldChange,
  DeadlineRule,
  DeadlineRuleSetting,
  NewCustomField,
} from "../src/features/settings/settings-types";
import type { ImportKind } from "../src/features/imports/import-types";
import { ALL_DEADLINES, caseDeadlines, upcomingDeadlines } from "../src/test/deadline-fixtures";
import { cleanReport, reportWithErrors } from "../src/test/import-fixtures";
import { tasksBackend } from "../src/test/task-fixtures";
import type { TaskView } from "../src/features/tasks/task-types";
import type { DeadlineAlert, NewsItem } from "../src/features/news/news-types";
import { newsBackend } from "../src/test/news-fixtures";
import type { JusValueView } from "../src/features/fees/fee-types";
import { feesBackend } from "../src/test/fee-fixtures";
import { publicDeadlineBackend } from "../src/test/public-deadline-fixtures";
import type { ClientView, PersonListItem } from "../src/features/persons/person-api";
import { personsBackend } from "../src/test/person-fixtures";
import { DEMO_PASSWORD, twoFactorBackend } from "../src/test/two-factor-fixtures";
import { FIRM_USERS, firmUsersBackend } from "../src/test/firm-user-fixtures";
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
  /** The signed-in user's role; the owner by default. */
  role?: "OWNER" | "LAWYER" | "PARALEGAL" | "ADMIN_STAFF";
  /**
   * The practice areas the firm works in; only penal by default. With "civil" on, the case list
   * also serves a fictitious civil case.
   */
  areas?: string[];
  /** The firm turned the AI assistance on (it is off by default, as in the backend). */
  aiAssist?: boolean;
  /** The member already has a calendar link, created at this instant; none by default. */
  calendarFeedSince?: string;
  /** Tasks `/api/v1/tasks` serves (filtered, paged, with state); none by default. */
  tasks?: TaskView[];
  /** Entries the wall serves (paged, with state); none by default. */
  news?: NewsItem[];
  /** Deadlines due soon on the wall's first page; none by default. */
  dueSoon?: DeadlineAlert[];
  /** The wall answers 500, to show its error state. */
  newsFails?: boolean;
  /** The firm's JUS values (with state); the fictitious ones by default. */
  jusValues?: JusValueView[];
  /** Today for the JUS value that applies; the machine's day by default. */
  today?: string;
  /** The public calculation answers 429 (rate limit), to show its message. */
  publicThrottled?: boolean;
  /**
   * Persons the Personas screen serves (with state, clients and contacts too). Off by default:
   * the T35 forms backend then answers the defendant picker's searches.
   */
  persons?: PersonListItem[];
  /** The clients of those persons; the fictitious ones by default. */
  clients?: ClientView[];
  /** The signed-in user's second factor (T61); on with 10 recovery codes by default. */
  twoFactor?: { enabled: boolean; remaining?: number };
  /**
   * The user signs in with a temporary password and must choose their own (T62). Every call but
   * /me, the CSRF token, the password change and the logout then answers 403.
   */
  passwordChangeRequired?: boolean;
  /** Asking for a password reset link answers 429 (T71), to show its message. */
  passwordResetThrottled?: boolean;
}

/** The fictitious token of the emailed reset link (T71): 43 base64url characters. */
export const RESET_TOKEN = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_AbCdE";

/**
 * The settings endpoints (T25) over the fictitious fixtures, with state so a change shows up in
 * the next GET. Undefined when the request is not one of them.
 */
function settingsBackend() {
  const catalogsByArea: Record<string, CatalogView[]> = {
    penal: structuredClone(SETTINGS_CATALOGS),
    civil: structuredClone(CIVIL_CATALOGS),
  };
  const fields: CustomField[] = structuredClone([...CASE_FIELDS, ...DEFENDANT_FIELDS]);
  const rules: DeadlineRule[] = structuredClone(DEADLINE_RULES);
  let next = 100;

  return (
    method: string,
    url: URL,
    body: () => unknown,
  ): { status: number; json?: unknown } | undefined => {
    const path = url.pathname;
    const catalogs = catalogsByArea[url.searchParams.get("area") ?? "penal"] ?? [];
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
function caseResource(path: string, area: string | null): unknown {
  const catalog = /^\/api\/v1\/catalogs\/([a-z-]+)$/.exec(path)?.[1];
  if (catalog) return areaCatalog(catalog, area, CRIMINAL_CATALOGS);
  if (path === `/api/v1/cases/${DETAIL_CIVIL.id}`) return DETAIL_CIVIL;
  if (path === `/api/v1/cases/${DETAIL_CIVIL.id}/hearings`) return [];
  if (path === `/api/v1/cases/${DETAIL_CIVIL.id}/deadlines`) return [];
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
  const state = {
    signedIn: options.signedIn ?? false,
    pendingSecondFactor: false,
    areas: options.areas ?? ["penal"],
    aiAssist: options.aiAssist ?? false,
    calendarFeed: {
      active: options.calendarFeedSince !== undefined,
      createdAt: options.calendarFeedSince ?? null,
    } as CalendarFeedStatus,
    calendarFeedCount: 0,
    passwordChangeRequired: options.passwordChangeRequired ?? false,
    password: DEMO_PASSWORD,
  };
  const calls: string[] = [];
  const settings = settingsBackend();
  const forms = formsBackend();
  const tasks = tasksBackend(options.tasks ?? [], DEMO_ME.id);
  const news = newsBackend(options.news ?? [], options.dueSoon ?? []);
  const fees = feesBackend(options.jusValues, {
    today: options.today,
    role: options.role ?? DEMO_ME.role,
  });

  const twoFactor = twoFactorBackend({
    enabled: options.twoFactor?.enabled ?? DEMO_ME.twoFactorEnabled,
    remaining: options.twoFactor?.remaining,
  });
  const publicDeadlines = publicDeadlineBackend();
  const firmUsers = firmUsersBackend(FIRM_USERS, { role: options.role ?? DEMO_ME.role });
  const allowedWithTemporaryPassword = new Set([
    "GET /api/v1/me",
    "GET /api/v1/auth/csrf",
    "POST /api/v1/me/password",
    "POST /api/v1/auth/logout",
  ]);
  const people = options.persons
    ? personsBackend(
        { persons: options.persons, clients: options.clients },
        { role: options.role ?? DEMO_ME.role },
      )
    : undefined;

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

    if (
      state.signedIn &&
      state.passwordChangeRequired &&
      !allowedWithTemporaryPassword.has(`${method} ${path}`)
    ) {
      return problem(route, 403, "password-change-required");
    }
    if (method === "POST" && path === "/api/v1/me/password" && state.signedIn) {
      const change = request.postDataJSON() as { currentPassword: string; newPassword: string };
      if (change.currentPassword !== state.password) {
        return problem(route, 422, "invalid-confirmation");
      }
      if (change.newPassword.length < 12 || change.newPassword === change.currentPassword) {
        return problem(route, 400, "invalid-password");
      }
      // Like PasswordController: the password changes and every session of the user ends.
      state.password = change.newPassword;
      state.passwordChangeRequired = false;
      state.signedIn = false;
      return route.fulfill({ status: 204 });
    }
    const firmUsersAnswer = state.signedIn
      ? firmUsers.answer(method, path, () => request.postDataJSON())
      : undefined;
    if (firmUsersAnswer) {
      if (firmUsersAnswer.problem) {
        return problem(route, firmUsersAnswer.status, firmUsersAnswer.problem);
      }
      return route.fulfill({ status: firmUsersAnswer.status, json: firmUsersAnswer.json });
    }

    const draft = /^\/api\/v1\/cases\/([0-9a-f-]+)\/hearing-drafts$/.exec(path);
    if (method === "POST" && draft) {
      if (!state.aiAssist) return problem(route, 409, "ai-assist-disabled");
      // What a provider would read from the fictitious notification of the e2e test.
      return route.fulfill({
        status: 200,
        json: {
          typeCode: "control-de-acusacion",
          date: "2026-12-02",
          time: "10:15",
          durationMinutes: 90,
          room: "Sala 4 (ficticia)",
          judge: null,
          ofijuReference: "OFIJU-0000/2026 (ficticia)",
          missing: ["judge"],
        },
      });
    }

    // The public calculator (T51) answers with or without a session.
    if (options.publicThrottled && path === "/api/v1/public/deadline-calculation") {
      return route.fulfill({
        status: 429,
        contentType: "application/problem+json",
        headers: { "Retry-After": "30" },
        body: JSON.stringify({ type: "/problems/public-calculator-throttled", status: 429 }),
      });
    }
    const publicAnswer =
      method === "GET" ? publicDeadlines(path, Object.fromEntries(url.searchParams)) : undefined;
    if (publicAnswer) {
      if (publicAnswer.problem) return problem(route, publicAnswer.status, publicAnswer.problem);
      return route.fulfill({ status: publicAnswer.status, json: publicAnswer.json });
    }

    const twoFactorAnswer = state.signedIn
      ? twoFactor.answer(method, path, () => request.postDataJSON())
      : undefined;
    if (twoFactorAnswer) {
      if (twoFactorAnswer.problem) {
        return route.fulfill({
          status: twoFactorAnswer.status,
          contentType: "application/problem+json",
          headers: twoFactorAnswer.headers,
          body: JSON.stringify({
            type: `/problems/${twoFactorAnswer.problem}`,
            status: twoFactorAnswer.status,
          }),
        });
      }
      return twoFactorAnswer.json === undefined
        ? route.fulfill({ status: twoFactorAnswer.status })
        : route.fulfill({ status: twoFactorAnswer.status, json: twoFactorAnswer.json });
    }

    const hearingIcs = /^\/api\/v1\/hearings\/([0-9a-f-]+)\/calendar\.ics$/.exec(path);
    if (method === "GET" && hearingIcs && state.signedIn) {
      return route.fulfill({
        status: 200,
        contentType: "text/calendar;charset=UTF-8",
        headers: { "Content-Disposition": 'attachment; filename="audiencia.ics"' },
        body: [
          "BEGIN:VCALENDAR",
          "VERSION:2.0",
          "PRODID:-//Gestor de causas (e2e)//ES",
          "BEGIN:VEVENT",
          `UID:${hearingIcs[1]}@e2e`,
          "DTSTAMP:20261123T132000Z",
          "DTSTART:20261123T140000Z",
          "DTEND:20261123T150000Z",
          "SUMMARY:Audiencia ficticia",
          "END:VEVENT",
          "END:VCALENDAR",
          "",
        ].join("\r\n"),
      });
    }

    switch (`${method} ${path}`) {
      case "GET /api/v1/me/calendar-feed":
        return route.fulfill({ status: 200, json: state.calendarFeed });
      case "POST /api/v1/me/calendar-feed": {
        const createdAt = "2026-11-23T13:20:00Z";
        state.calendarFeed = { active: true, createdAt };
        // A fictitious secret: the real one is 256 random bits, base64url.
        const secret = `e2e-secreto-ficticio-${++state.calendarFeedCount}`;
        return route.fulfill({
          status: 201,
          json: { path: `/api/v1/calendar-feed/${secret}.ics`, createdAt },
        });
      }
      case "POST /api/v1/me/calendar-feed/revoke":
        state.calendarFeed = { active: false, createdAt: null };
        return route.fulfill({ status: 204 });
      case "GET /api/v1/ai-assist":
        return route.fulfill({
          status: 200,
          json: { available: true, enabled: state.aiAssist, provider: "Google Gemini" },
        });
      case "PUT /api/v1/ai-assist": {
        state.aiAssist = (request.postDataJSON() as { enabled: boolean }).enabled;
        return route.fulfill({
          status: 200,
          json: { available: true, enabled: state.aiAssist, provider: "Google Gemini" },
        });
      }
      case "GET /api/v1/auth/csrf":
        return route.fulfill({
          status: 204,
          headers: { "Set-Cookie": "XSRF-TOKEN=e2e-token; Path=/; SameSite=Lax" },
        });
      case "GET /api/v1/me":
        return state.signedIn
          ? route.fulfill({
              status: 200,
              json: {
                ...DEMO_ME,
                role: options.role ?? DEMO_ME.role,
                twoFactorEnabled: twoFactor.state.enabled,
                passwordChangeRequired: state.passwordChangeRequired,
              },
            })
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
      // Like PasswordResetController: the same 202 whether or not the account exists.
      case "POST /api/v1/auth/password-reset":
        if (options.passwordResetThrottled) {
          return route.fulfill({
            status: 429,
            contentType: "application/problem+json",
            headers: { "Retry-After": "600" },
            body: JSON.stringify({ type: "/problems/password-reset-throttled", status: 429 }),
          });
        }
        return route.fulfill({ status: 202 });
      case "POST /api/v1/auth/password-reset/confirm": {
        const reset = request.postDataJSON() as { token: string; newPassword: string };
        if (reset.token !== RESET_TOKEN) return problem(route, 400, "invalid-reset-token");
        if (reset.newPassword.length < 12) return problem(route, 400, "invalid-password");
        state.password = reset.newPassword;
        state.signedIn = false;
        return route.fulfill({ status: 204 });
      }
      case "GET /api/v1/agenda": {
        if (!state.signedIn) return problem(route, 401, "authentication-required");
        if (options.agendaFails) return problem(route, 500, "internal");
        const query = url.searchParams;
        return route.fulfill({
          status: 200,
          json: agendaFor(
            [...(options.hearings ?? []), ...forms.agendaItems()],
            query.get("from") ?? "",
            query.get("to") ?? "",
            query.get("lawyerId"),
          ),
        });
      }
      case "GET /api/v1/practice-areas":
        if (!state.signedIn) return problem(route, 401, "authentication-required");
        return route.fulfill({
          status: 200,
          json: availableAreas(state.areas)
            .filter((area) => area.enabled)
            .map((area) => ({ ...area, enabled: undefined })),
        });
      case "GET /api/v1/practice-areas/available":
        if (!state.signedIn) return problem(route, 401, "authentication-required");
        return route.fulfill({ status: 200, json: availableAreas(state.areas) });
      case "PUT /api/v1/practice-areas/enabled": {
        if (!state.signedIn) return problem(route, 401, "authentication-required");
        if ((options.role ?? DEMO_ME.role) !== "OWNER") return problem(route, 403, "access-denied");
        const { codes } = request.postDataJSON() as { codes: string[] };
        if (codes.length === 0) return problem(route, 400, "invalid-practice-areas");
        // The criminal fixtures are active cases: penal cannot be turned off.
        if (!codes.includes("penal")) return problem(route, 409, "practice-area-in-use");
        state.areas = availableAreas(codes)
          .filter((area) => area.enabled)
          .map((area) => area.code);
        return route.fulfill({ status: 200, json: availableAreas(state.areas) });
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
          json: casePageFor(
            [
              ...forms.caseViews(),
              ...(options.cases ?? CASES),
              ...(state.areas.includes("civil") && !options.cases ? [CASE_CIVIL] : []),
            ],
            {
              q: query.get("q"),
              includeArchived: query.get("includeArchived") === "true",
              area: query.get("area"),
              page: Number(query.get("page") ?? 0),
              size: Number(query.get("size") ?? 20),
            },
          ),
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
        const importKind = /^\/api\/v1\/imports\/(persons|cases|hearings)(\/template)?$/.exec(path);
        if (importKind && state.signedIn) {
          const kind = importKind[1] as ImportKind;
          if (importKind[2]) {
            return route.fulfill({
              status: 200,
              contentType: "text/csv;charset=UTF-8",
              body: "tipo_persona;nombres;apellidos\nhumana;Juan;Ejemplo\n",
            });
          }
          if (method !== "POST") return problem(route, 404, "not-found");
          // The file's name decides the answer: "...errores..." has row errors.
          const fileName =
            /filename="([^"]*)"/.exec(request.postDataBuffer()?.toString("latin1") ?? "")?.[1] ??
            "";
          const dryRun = url.searchParams.get("dryRun") !== "false";
          const report = fileName.includes("errores")
            ? reportWithErrors(kind, dryRun)
            : cleanReport(kind, dryRun);
          if (!dryRun && report.errorRows > 0) {
            return route.fulfill({
              status: 422,
              contentType: "application/problem+json",
              body: JSON.stringify({ type: "/problems/import-has-errors", status: 422, report }),
            });
          }
          return route.fulfill({ status: 200, json: report });
        }
        const peopleAnswer =
          state.signedIn && people
            ? people(method, path, Object.fromEntries(url.searchParams), () =>
                request.postDataJSON(),
              )
            : undefined;
        if (peopleAnswer) {
          if (peopleAnswer.problem) {
            return route.fulfill({
              status: peopleAnswer.status,
              contentType: "application/problem+json",
              body: JSON.stringify({
                type: `/problems/${peopleAnswer.problem}`,
                status: peopleAnswer.status,
                ...peopleAnswer.members,
              }),
            });
          }
          return peopleAnswer.json === undefined
            ? route.fulfill({ status: peopleAnswer.status })
            : route.fulfill({ status: peopleAnswer.status, json: peopleAnswer.json });
        }
        const tasksAnswer = state.signedIn
          ? tasks(method, path, Object.fromEntries(url.searchParams), () => request.postDataJSON())
          : undefined;
        if (tasksAnswer) {
          if (tasksAnswer.status === 404) return problem(route, 404, "not-found");
          return tasksAnswer.json === undefined
            ? route.fulfill({ status: tasksAnswer.status })
            : route.fulfill({ status: tasksAnswer.status, json: tasksAnswer.json });
        }
        const feesAnswer = state.signedIn
          ? fees(method, path, Object.fromEntries(url.searchParams), () => request.postDataJSON())
          : undefined;
        if (feesAnswer) {
          if (feesAnswer.problem) return problem(route, feesAnswer.status, feesAnswer.problem);
          return feesAnswer.json === undefined
            ? route.fulfill({ status: feesAnswer.status })
            : route.fulfill({ status: feesAnswer.status, json: feesAnswer.json });
        }
        if (state.signedIn && options.newsFails && path.startsWith("/api/v1/news")) {
          return problem(route, 500, "internal");
        }
        const newsAnswer = state.signedIn
          ? news(method, path, Object.fromEntries(url.searchParams), () => request.postDataJSON())
          : undefined;
        if (newsAnswer) {
          if (newsAnswer.status >= 400) {
            const type =
              newsAnswer.status === 400
                ? "invalid-post"
                : newsAnswer.status === 403
                  ? "access-denied"
                  : "not-found";
            return problem(route, newsAnswer.status, type);
          }
          return newsAnswer.json === undefined
            ? route.fulfill({ status: newsAnswer.status })
            : route.fulfill({ status: newsAnswer.status, json: newsAnswer.json });
        }
        const settingsAnswer = state.signedIn
          ? settings(method, url, () => request.postDataJSON())
          : undefined;
        if (settingsAnswer) {
          return settingsAnswer.status === 404
            ? problem(route, 404, "not-found")
            : route.fulfill({ status: settingsAnswer.status, json: settingsAnswer.json });
        }
        const formsAnswer = state.signedIn
          ? forms.answer(method, url, () => request.postDataJSON())
          : undefined;
        if (formsAnswer)
          return route.fulfill({ status: formsAnswer.status, json: formsAnswer.json });
        if (method === "GET" && state.signedIn) {
          const found = caseResource(path, url.searchParams.get("area"));
          if (found !== undefined) return route.fulfill({ status: 200, json: found });
        }
        return problem(route, 404, "not-found");
      }
    }
  });

  return { state, calls };
}
