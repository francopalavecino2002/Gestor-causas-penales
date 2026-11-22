import { describe, expect, it, vi } from "vitest";

import { apiFetch, ApiError, CSRF_UNAVAILABLE, NETWORK_ERROR, UNKNOWN_PROBLEM } from "@/lib/api";
import { json, mockFetch, noContent, problem } from "@/test/mock-api";

async function catchError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error("Expected the request to fail");
}

describe("apiFetch", () => {
  it("sends the session cookie and parses JSON", async () => {
    const requests = mockFetch({ "GET /api/v1/me": () => json(200, { id: "1" }) });

    await expect(apiFetch("/api/v1/me")).resolves.toEqual({ id: "1" });

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ credentials: "include", method: "GET" });
    expect(requests[0]?.headers["x-xsrf-token"]).toBeUndefined();
  });

  it("fetches the CSRF cookie first and sends it as X-XSRF-TOKEN on writes", async () => {
    const requests = mockFetch({ "POST /api/v1/auth/logout": () => noContent() });

    await expect(apiFetch("/api/v1/auth/logout", { method: "POST" })).resolves.toBeUndefined();

    expect(requests.map((r) => `${r.method} ${r.path}`)).toEqual([
      "GET /api/v1/auth/csrf",
      "POST /api/v1/auth/logout",
    ]);
    expect(requests[1]?.headers["x-xsrf-token"]).toBe("token-1");
  });

  it("reads the cookie fresh on every write (the token rotates after login)", async () => {
    document.cookie = "XSRF-TOKEN=before-login; path=/";
    const requests = mockFetch({
      "POST /api/v1/auth/login": () => {
        document.cookie = "XSRF-TOKEN=after-login; path=/";
        return noContent();
      },
      "POST /api/v1/auth/logout": () => noContent(),
    });

    await apiFetch("/api/v1/auth/login", { method: "POST", body: { tenant: "x" } });
    await apiFetch("/api/v1/auth/logout", { method: "POST" });

    expect(requests.map((r) => r.headers["x-xsrf-token"])).toEqual(["before-login", "after-login"]);
    expect(requests[0]?.headers["content-type"]).toBe("application/json");
    expect(requests[0]?.body).toEqual({ tenant: "x" });
  });

  it("retries a write once with a fresh token after a 403", async () => {
    document.cookie = "XSRF-TOKEN=stale; path=/";
    let attempts = 0;
    const requests = mockFetch({
      "POST /api/v1/auth/logout": () =>
        ++attempts === 1 ? problem(403, "access-denied") : noContent(),
    });

    await apiFetch("/api/v1/auth/logout", { method: "POST" });

    expect(requests.map((r) => `${r.method} ${r.path} ${r.headers["x-xsrf-token"] ?? ""}`)).toEqual(
      [
        "POST /api/v1/auth/logout stale",
        "GET /api/v1/auth/csrf ",
        "POST /api/v1/auth/logout token-1",
      ],
    );
  });

  it("turns problem+json into an ApiError with status, type and Retry-After", async () => {
    mockFetch({
      "POST /api/v1/auth/login": () => problem(429, "login-throttled", { "Retry-After": "120" }),
    });

    const error = await catchError(apiFetch("/api/v1/auth/login", { method: "POST", body: {} }));

    expect(error.status).toBe(429);
    expect(error.type).toBe("login-throttled");
    expect(error.retryAfter).toBe(120);
  });

  it("keeps the status when the error body is not JSON", async () => {
    mockFetch({
      "GET /api/v1/me": () => new Response("<html>Bad gateway</html>", { status: 502 }),
    });

    const error = await catchError(apiFetch("/api/v1/me"));

    expect(error.status).toBe(502);
    expect(error.type).toBe(UNKNOWN_PROBLEM);
  });

  it("rejects a successful answer that is not JSON", async () => {
    mockFetch({ "GET /api/v1/me": () => new Response("<html>Portal</html>", { status: 200 }) });

    const error = await catchError(apiFetch("/api/v1/me"));

    expect(error.status).toBe(200);
    expect(error.type).toBe(UNKNOWN_PROBLEM);
  });

  it("does not send a write when the server issues no CSRF cookie", async () => {
    const requests = mockFetch({
      "GET /api/v1/auth/csrf": () => noContent(),
      "POST /api/v1/auth/logout": () => noContent(),
    });

    const error = await catchError(apiFetch("/api/v1/auth/logout", { method: "POST" }));

    expect(error.type).toBe(CSRF_UNAVAILABLE);
    expect(requests.map((r) => `${r.method} ${r.path}`)).toEqual(["GET /api/v1/auth/csrf"]);
  });

  it("reports network failures as status 0", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const error = await catchError(apiFetch("/api/v1/me"));

    expect(error.status).toBe(0);
    expect(error.type).toBe(NETWORK_ERROR);
  });
});
