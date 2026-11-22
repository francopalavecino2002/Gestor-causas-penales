import { vi } from "vitest";

import { FIRM_TIME_ZONE } from "@/features/agenda/agenda-dates";
import type { Me } from "@/features/auth/auth-api";

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

/** Fictitious user of the fictitious demo firm. */
export const DEMO_ME: Me = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "lucia.ejemplo@example.com",
  displayName: "Lucía Ejemplo",
  role: "OWNER",
  twoFactorEnabled: false,
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
      body: typeof init.body === "string" ? JSON.parse(init.body) : undefined,
    };
    requests.push(request);
    const handler = table[`${method} ${url.pathname}`];
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
    "GET /api/v1/agenda": ({ query }) =>
      json(200, {
        from: query.from,
        to: query.to,
        timeZone: FIRM_TIME_ZONE,
        items: [],
      }),
    "GET /api/v1/detainee-alerts": () => json(200, []),
    ...routes,
  });
}

/** Anonymous session: /me answers 401. */
export function signedOut(routes: Record<string, Handler> = {}) {
  return mockFetch({
    "GET /api/v1/me": () => problem(401, "authentication-required"),
    ...routes,
  });
}
