import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";

import { ThemeProvider } from "@/components/theme/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { createAppRouter } from "@/router";

interface AppProps {
  queryClient: QueryClient;
  router: ReturnType<typeof createAppRouter>;
}

/** Root providers shared by the browser entry point and the tests. */
export function App({ queryClient, router }: AppProps) {
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
