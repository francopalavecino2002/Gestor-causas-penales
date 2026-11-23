import { useEffect, useId, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { FolderOpen, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { casesQueryOptions } from "@/features/cases/case-queries";

/** Wait this long after the last keystroke before searching. */
export const CASE_SEARCH_DEBOUNCE_MS = 300;
/** How many cases the picker lists: enough to choose, short enough for a phone. */
const SHOWN = 8;

function useDebounced(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/**
 * Finds the case of a new hearing by caption, legajo or number (the case list's own search; the
 * archived cases are left out, since they take no hearings). Without a search it lists the
 * firm's cases as the list does, so a firm with few cases just taps one.
 */
export function CasePicker({
  value,
  caption,
  onChange,
  error,
}: {
  value: string;
  caption: string;
  onChange: (selected: { id: string; caption: string } | null) => void;
  error?: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState("");
  const q = useDebounced(draft.trim(), CASE_SEARCH_DEBOUNCE_MS);
  const results = useQuery({
    ...casesQueryOptions({ q: q || undefined, includeArchived: false, page: 0 }),
    enabled: !value,
    placeholderData: keepPreviousData,
  });

  if (value) {
    return (
      <div className="grid gap-1.5">
        <p className="text-body font-semibold">Causa</p>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary bg-accent px-3.5 py-2.5">
          <p className="flex min-w-0 items-center gap-2 text-body">
            <FolderOpen aria-hidden="true" className="size-5 shrink-0 text-primary" />
            <span className="min-w-0 font-semibold">
              <span className="sr-only">Causa elegida: </span>
              {caption}
            </span>
          </p>
          <Button variant="outline" onClick={() => onChange(null)}>
            Cambiá la causa
          </Button>
        </div>
      </div>
    );
  }

  const items = (results.data?.items ?? []).slice(0, SHOWN);
  return (
    <div className="grid gap-2.5">
      <Field>
        <Label htmlFor={`${id}-search`}>Buscá la causa</Label>
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id={`${id}-search`}
            type="search"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            autoComplete="off"
            enterKeyHint="search"
            className="pl-11"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : `${id}-hint`}
            onKeyDown={(event) => event.key === "Enter" && event.preventDefault()}
          />
        </div>
        <FieldDescription id={`${id}-hint`}>
          Por carátula, legajo del MPF, número de la OFIJU o número interno.
        </FieldDescription>
        <FieldError id={`${id}-error`}>{error}</FieldError>
      </Field>
      {results.isPending ? (
        <div role="status" aria-label="Buscando causas" className="grid gap-2">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      ) : results.isError ? (
        <p role="alert" className="text-meta">
          No pudimos buscar las causas. Revisá tu conexión y volvé a escribir.
        </p>
      ) : items.length === 0 ? (
        <p aria-live="polite" className="text-meta text-muted-foreground">
          {q
            ? `No hay causas con «${q}». Probá con otra parte de la carátula o con el legajo.`
            : "Todavía no hay causas. Cargá la causa primero desde «Causas»."}
        </p>
      ) : (
        <fieldset className="grid gap-2">
          <legend className="sr-only">Causas encontradas</legend>
          {items.map((item) => (
            <label
              key={item.id}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border bg-card px-3.5 py-2.5 transition-colors duration-fast ease-out hover:bg-accent has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring"
            >
              <input
                type="radio"
                name={`${id}-case`}
                className="size-4.5 shrink-0 accent-primary focus-visible:outline-none"
                onChange={() => onChange({ id: item.id, caption: item.caption })}
              />
              <span className="grid min-w-0">
                <span className="text-body font-semibold">{item.caption}</span>
                {item.mpfLegajo && (
                  <span className="text-small text-muted-foreground tabular-nums">
                    Legajo {item.mpfLegajo}
                  </span>
                )}
              </span>
            </label>
          ))}
        </fieldset>
      )}
    </div>
  );
}
