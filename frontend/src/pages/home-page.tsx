import { useSearch } from "@tanstack/react-router";

import { AgendaPage } from "@/features/agenda/agenda-page";

/** Home is the hearing agenda (the core of the product), driven by the URL's search params. */
export function HomePage() {
  const search = useSearch({ from: "/app/" });
  return <AgendaPage search={search} />;
}
