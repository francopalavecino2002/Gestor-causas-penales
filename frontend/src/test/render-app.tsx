import { createMemoryHistory } from "@tanstack/react-router";
import { render } from "@testing-library/react";

import { App } from "@/app";
import { createQueryClient } from "@/lib/query-client";
import { createAppRouter } from "@/router";

/** Renders the whole app (providers + router) at the given path. */
export function renderApp(path = "/") {
  const history = createMemoryHistory({ initialEntries: [path] });
  const router = createAppRouter({ history });
  return { router, ...render(<App queryClient={createQueryClient()} router={router} />) };
}
