import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "@/app";
import { createQueryClient } from "@/lib/query-client";
import { createAppRouter } from "@/router";

import "@fontsource-variable/atkinson-hyperlegible-next";
import "./index.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root not found in index.html");
}

createRoot(rootElement).render(
  <StrictMode>
    <App queryClient={createQueryClient()} router={createAppRouter()} />
  </StrictMode>,
);
