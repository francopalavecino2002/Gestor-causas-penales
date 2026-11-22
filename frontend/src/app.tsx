import { useEffect } from "react";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";

import { ThemeProvider } from "@/components/theme/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { redirectToLoginOnUnauthorized } from "@/features/auth/session-expiry";
import type { AppRouter } from "@/router";

interface AppProps {
  queryClient: QueryClient;
  router: AppRouter;
}

/** Root providers shared by the browser entry point and the tests. */
export function App({ queryClient, router }: AppProps) {
  useEffect(() => redirectToLoginOnUnauthorized(queryClient, router), [queryClient, router]);

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <RouterProvider router={router} />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
