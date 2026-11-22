/*
 * Thin fetch wrapper for the backend API (same origin; Vite proxies /api to the backend).
 * Session cookie + CSRF double-submit (ADR-0008): every non-GET request sends the XSRF-TOKEN
 * cookie value in the X-XSRF-TOKEN header. The token rotates after login, so it is read fresh
 * before each request, and fetched from /auth/csrf when the cookie is missing.
 */

const CSRF_COOKIE = "XSRF-TOKEN";
const CSRF_HEADER = "X-XSRF-TOKEN";
const CSRF_PATH = "/api/v1/auth/csrf";

/** Problem type used when the request never reached the server (offline, DNS, CORS...). */
export const NETWORK_ERROR = "network-error";

/** Problem type used when the server did not issue the CSRF cookie, so no write can be sent. */
export const CSRF_UNAVAILABLE = "csrf-unavailable";

/** Problem type used when the server answered an error without a problem+json body. */
export const UNKNOWN_PROBLEM = "unknown";

/** An error answer of the API: HTTP status, problem type (`/problems/<type>`) and extras. */
export class ApiError extends Error {
  readonly status: number;
  /** Last segment of the problem `type`, e.g. "invalid-credentials". */
  readonly type: string;
  /** Seconds from the `Retry-After` header, when the server sent one (429). */
  readonly retryAfter: number | undefined;
  readonly detail: string | undefined;

  constructor(options: { status: number; type: string; retryAfter?: number; detail?: string }) {
    super(`API error ${options.status} (${options.type})`);
    this.name = "ApiError";
    this.status = options.status;
    this.type = options.type;
    this.retryAfter = options.retryAfter;
    this.detail = options.detail;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * True for any 401. Outside the login (whose calls bypass the query caches) a 401 means the
 * session is missing or expired.
 */
export function isUnauthorized(error: unknown): boolean {
  return isApiError(error) && error.status === 401;
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface RequestOptions {
  method?: Method;
  /** Serialized as JSON. */
  body?: unknown;
  signal?: AbortSignal;
}

/**
 * Calls the API and returns the parsed JSON body (`undefined` for 204 and other empty answers).
 * Throws {@link ApiError} for non-2xx answers and for network failures.
 */
export async function apiFetch<T = undefined>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const method = options.method ?? "GET";
  const response = await send(path, method, options);

  // A 403 on a write can be a stale CSRF token (rotated in another tab): refresh it once.
  if (response.status === 403 && method !== "GET") {
    await fetchCsrfToken();
    return parse<T>(await send(path, method, options));
  }
  return parse<T>(response);
}

async function send(path: string, method: Method, options: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (method !== "GET") headers[CSRF_HEADER] = await csrfToken();

  try {
    return await fetch(path, {
      method,
      headers,
      credentials: "include",
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError({ status: 0, type: NETWORK_ERROR });
  }
}

async function parse<T>(response: Response): Promise<T> {
  if (!response.ok) throw await toApiError(response);
  const text = await response.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    // A 2xx that is not JSON (e.g. a proxy's HTML page): not an answer of our API.
    throw new ApiError({ status: response.status, type: UNKNOWN_PROBLEM });
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  let type = UNKNOWN_PROBLEM;
  let detail: string | undefined;
  try {
    const problem = (await response.json()) as { type?: unknown; detail?: unknown };
    if (typeof problem.type === "string" && problem.type.length > 0) {
      type = problem.type.split("/").filter(Boolean).pop() ?? UNKNOWN_PROBLEM;
    }
    if (typeof problem.detail === "string") detail = problem.detail;
  } catch {
    // Not JSON (a proxy error page, an empty body): keep the status and an unknown type.
  }
  return new ApiError({
    status: response.status,
    type,
    detail,
    retryAfter: parseRetryAfter(response.headers.get("Retry-After")),
  });
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);
  const date = Date.parse(value);
  if (Number.isNaN(date)) return undefined;
  return Math.max(0, Math.ceil((date - Date.now()) / 1000));
}

function readCookie(name: string): string | undefined {
  const prefix = `${name}=`;
  const entry = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  return entry ? decodeURIComponent(entry.slice(prefix.length)) : undefined;
}

async function csrfToken(): Promise<string> {
  return readCookie(CSRF_COOKIE) ?? (await fetchCsrfToken());
}

async function fetchCsrfToken(): Promise<string> {
  try {
    await fetch(CSRF_PATH, { credentials: "include", headers: { Accept: "application/json" } });
  } catch {
    throw new ApiError({ status: 0, type: NETWORK_ERROR });
  }
  const token = readCookie(CSRF_COOKIE);
  // Without the token every write would be rejected: fail here with a clear error instead.
  if (!token) throw new ApiError({ status: 0, type: CSRF_UNAVAILABLE });
  return token;
}
