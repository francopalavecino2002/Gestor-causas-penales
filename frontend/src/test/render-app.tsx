import { createMemoryHistory } from "@tanstack/react-router";
import { render } from "@testing-library/react";

import { App } from "@/app";
import { createQueryClient } from "@/lib/query-client";
import { createAppRouter } from "@/router";

/** Renders the whole app (providers + router) at the given path. */
export function renderApp(path = "/") {
  const history = createMemoryHistory({ initialEntries: [path] });
  const queryClient = createQueryClient();
  const router = createAppRouter({ queryClient, history });
  return {
    router,
    queryClient,
    ...render(<App queryClient={queryClient} router={router} />),
  };
}
