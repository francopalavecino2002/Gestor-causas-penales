import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { ME_QUERY_KEY } from "@/features/auth/me-query";
import { redirectToLoginOnUnauthorized } from "@/features/auth/session-expiry";
import { ApiError } from "@/lib/api";
import type { AppRouter } from "@/router";
import { DEMO_ME } from "@/test/mock-api";

function setUp(pathname: string, href = pathname) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(ME_QUERY_KEY, DEMO_ME);
  const navigate = vi.fn(() => Promise.resolve());
  const router = { state: { location: { pathname, href } }, navigate } as unknown as AppRouter;
  const unsubscribe = redirectToLoginOnUnauthorized(queryClient, router);
  const fail = (error: Error) =>
    queryClient
      .fetchQuery({ queryKey: ["something"], queryFn: () => Promise.reject(error) })
      .catch(() => undefined);
  return { queryClient, navigate, unsubscribe, fail };
}

describe("redirectToLoginOnUnauthorized", () => {
  it("forgets the user and opens the login, keeping the page", async () => {
    const { queryClient, navigate, fail } = setUp("/causas", "/causas?estado=abierta");

    await fail(new ApiError({ status: 401, type: "authentication-required" }));

    expect(queryClient.getQueryData(ME_QUERY_KEY)).toBeNull();
    expect(navigate).toHaveBeenCalledWith({
      to: "/ingresar",
      search: { redirect: "/causas?estado=abierta" },
      replace: true,
    });
  });

  it("does not navigate again when already on the login", async () => {
    const { navigate, fail } = setUp("/ingresar");

    await fail(new ApiError({ status: 401, type: "authentication-required" }));

    expect(navigate).not.toHaveBeenCalled();
  });

  it("ignores errors that are not a 401", async () => {
    const { queryClient, navigate, fail } = setUp("/causas");

    await fail(new ApiError({ status: 403, type: "access-denied" }));
    await fail(new ApiError({ status: 500, type: "unknown" }));
    await fail(new Error("boom"));

    expect(queryClient.getQueryData(ME_QUERY_KEY)).toEqual(DEMO_ME);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("stops listening once unsubscribed", async () => {
    const { navigate, unsubscribe, fail } = setUp("/causas");

    unsubscribe();
    await fail(new ApiError({ status: 401, type: "authentication-required" }));

    expect(navigate).not.toHaveBeenCalled();
  });
});
