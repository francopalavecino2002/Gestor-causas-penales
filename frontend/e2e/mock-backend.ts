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
import type { DeadlineView } from "../src/features/deadlines/deadline-types";
import { ALL_DEADLINES, caseDeadlines, upcomingDeadlines } from "../src/test/deadline-fixtures";

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
      default:
        if (method === "GET" && state.signedIn) {
          const found = caseResource(path);
          if (found !== undefined) return route.fulfill({ status: 200, json: found });
        }
        return problem(route, 404, "not-found");
    }
  });

  return { state, calls };
}
