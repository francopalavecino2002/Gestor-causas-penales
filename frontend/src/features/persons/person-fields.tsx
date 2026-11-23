import { useEffect, useId, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Search, UserRound } from "lucide-react";
import { useFormContext, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { searchPersons, type PersonView } from "@/features/persons/person-api";
import {
  DOCUMENT_MAX,
  DOCUMENT_TYPE_LABELS,
  NAME_MAX,
  type PersonChoice,
} from "@/features/persons/person-schema";
import { cn } from "@/lib/utils";

/** Wait this long after the last keystroke before searching. */
export const PERSON_SEARCH_DEBOUNCE_MS = 300;
const MIN_QUERY = 2;

type PersonForm = { person: PersonChoice };

function useDebounced(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function documentLine(person: PersonView): string | null {
  if (!person.documentType || !person.documentNumber) return null;
  return `${DOCUMENT_TYPE_LABELS[person.documentType]} ${person.documentNumber}`;
}

const choiceCard =
  "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border bg-card px-3.5 py-2.5 transition-colors duration-fast ease-out hover:bg-accent has-checked:border-primary has-checked:bg-accent has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring";

/** Search the firm's persons and pick one. */
function ExistingPerson({ idPrefix }: { idPrefix: string }) {
  const {
    setValue,
    formState: { errors },
  } = useFormContext<PersonForm>();
  const personId = useWatch<PersonForm, "person.personId">({ name: "person.personId" });
  const personName = useWatch<PersonForm, "person.personName">({ name: "person.personName" });
  const [draft, setDraft] = useState("");
  const q = useDebounced(draft.trim(), PERSON_SEARCH_DEBOUNCE_MS);
  const enabled = q.length >= MIN_QUERY && !personId;
  const results = useQuery({
    queryKey: ["persons", "search", q] as const,
    queryFn: ({ signal }) => searchPersons(q, signal),
    enabled,
    placeholderData: keepPreviousData,
  });
  const error = errors.person?.personId?.message;
  const errorId = `${idPrefix}-person-error`;

  const choose = (person: PersonView) => {
    setValue("person.personId", person.id, { shouldValidate: true });
    setValue("person.personName", person.displayName);
  };

  if (personId) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary bg-accent px-3.5 py-2.5">
        <p className="flex min-w-0 items-center gap-2 text-body">
          <UserRound aria-hidden="true" className="size-5 shrink-0 text-primary" />
          <span className="min-w-0">
            <span className="sr-only">Persona elegida: </span>
            <span className="font-semibold">{personName}</span>
          </span>
        </p>
        <Button
          variant="outline"
          onClick={() => {
            setValue("person.personId", "");
            setValue("person.personName", "");
          }}
        >
          Cambiá la persona
        </Button>
      </div>
    );
  }

  const items = enabled ? (results.data?.items ?? []) : [];
  return (
    <div className="grid gap-2.5">
      <Field>
        <Label htmlFor={`${idPrefix}-person-search`}>Buscá por nombre o documento</Label>
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id={`${idPrefix}-person-search`}
            type="search"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            autoComplete="off"
            enterKeyHint="search"
            className="pl-11"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : `${idPrefix}-person-hint`}
            // Enter searches here; it must not submit the whole form.
            onKeyDown={(event) => event.key === "Enter" && event.preventDefault()}
          />
        </div>
        <FieldDescription id={`${idPrefix}-person-hint`}>
          Escribí al menos {MIN_QUERY} letras o números del documento.
        </FieldDescription>
        <FieldError id={errorId}>{error}</FieldError>
      </Field>
      {enabled && results.isPending ? (
        <div role="status" aria-label="Buscando personas" className="grid gap-2">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      ) : enabled && results.isError ? (
        <p role="alert" className="text-meta">
          No pudimos buscar personas. Revisá tu conexión y volvé a escribir, o cargá una nueva.
        </p>
      ) : enabled && items.length === 0 ? (
        <p aria-live="polite" className="text-meta text-muted-foreground">
          No hay personas con «{q}». Cargala como persona nueva.
        </p>
      ) : items.length > 0 ? (
        <fieldset className="grid gap-2" aria-live="polite">
          <legend className="sr-only">Personas encontradas</legend>
          {items.map((person) => (
            <label key={person.id} className={choiceCard}>
              <input
                type="radio"
                name={`${idPrefix}-person-result`}
                className="size-4.5 shrink-0 accent-primary focus-visible:outline-none"
                onChange={() => choose(person)}
              />
              <span className="grid min-w-0">
                <span className="text-body font-semibold">{person.displayName}</span>
                {documentLine(person) && (
                  <span className="text-small text-muted-foreground tabular-nums">
                    {documentLine(person)}
                  </span>
                )}
              </span>
            </label>
          ))}
        </fieldset>
      ) : null}
    </div>
  );
}

/** First and last names and the document of a person not loaded yet. */
function NewPerson({ idPrefix }: { idPrefix: string }) {
  const {
    register,
    formState: { errors },
  } = useFormContext<PersonForm>();
  const fieldError = (name: "firstNames" | "lastNames" | "documentNumber") =>
    errors.person?.[name]?.message;
  const described = (name: string, error: string | undefined, hint?: string) =>
    [error ? `${idPrefix}-${name}-error` : null, hint ?? null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className="grid items-start gap-4 sm:grid-cols-2">
      <Field>
        <Label htmlFor={`${idPrefix}-lastNames`}>Apellidos</Label>
        <Input
          id={`${idPrefix}-lastNames`}
          maxLength={NAME_MAX}
          autoComplete="off"
          aria-invalid={fieldError("lastNames") ? true : undefined}
          aria-describedby={described("lastNames", fieldError("lastNames"))}
          {...register("person.lastNames")}
        />
        <FieldError id={`${idPrefix}-lastNames-error`}>{fieldError("lastNames")}</FieldError>
      </Field>
      <Field>
        <Label htmlFor={`${idPrefix}-firstNames`}>Nombres</Label>
        <Input
          id={`${idPrefix}-firstNames`}
          maxLength={NAME_MAX}
          autoComplete="off"
          aria-invalid={fieldError("firstNames") ? true : undefined}
          aria-describedby={described("firstNames", fieldError("firstNames"))}
          {...register("person.firstNames")}
        />
        <FieldError id={`${idPrefix}-firstNames-error`}>{fieldError("firstNames")}</FieldError>
      </Field>
      <Field>
        <Label htmlFor={`${idPrefix}-documentType`}>Tipo de documento</Label>
        <Select id={`${idPrefix}-documentType`} {...register("person.documentType")}>
          {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Field>
      <Field>
        <Label htmlFor={`${idPrefix}-documentNumber`}>Número de documento</Label>
        <Input
          id={`${idPrefix}-documentNumber`}
          inputMode="text"
          maxLength={DOCUMENT_MAX}
          autoComplete="off"
          className="tabular-nums"
          aria-invalid={fieldError("documentNumber") ? true : undefined}
          aria-describedby={described(
            "documentNumber",
            fieldError("documentNumber"),
            `${idPrefix}-documentNumber-hint`,
          )}
          {...register("person.documentNumber")}
        />
        <FieldDescription id={`${idPrefix}-documentNumber-hint`}>
          Opcional. Con o sin puntos.
        </FieldDescription>
        <FieldError id={`${idPrefix}-documentNumber-error`}>
          {fieldError("documentNumber")}
        </FieldError>
      </Field>
    </div>
  );
}

/**
 * Who the defendant is: a person the firm already has, found by name or document, or a new one.
 * Lives inside a react-hook-form `FormProvider` whose values have a `person` choice.
 */
export function PersonFields({ legend }: { legend: string }) {
  const idPrefix = useId();
  const { register } = useFormContext<PersonForm>();
  const mode = useWatch<PersonForm, "person.mode">({ name: "person.mode" });
  return (
    <fieldset className="grid gap-3">
      <legend className="mb-1.5 text-body font-semibold">{legend}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className={choiceCard}>
          <input
            type="radio"
            value="existing"
            className="size-4.5 shrink-0 accent-primary focus-visible:outline-none"
            {...register("person.mode")}
          />
          <span className="text-body font-semibold">Ya está cargada</span>
        </label>
        <label className={choiceCard}>
          <input
            type="radio"
            value="new"
            className="size-4.5 shrink-0 accent-primary focus-visible:outline-none"
            {...register("person.mode")}
          />
          <span className="text-body font-semibold">Es una persona nueva</span>
        </label>
      </div>
      <div className={cn("grid gap-3", mode === "new" && "pt-1")}>
        {mode === "new" ? (
          <NewPerson idPrefix={idPrefix} />
        ) : (
          <ExistingPerson idPrefix={idPrefix} />
        )}
      </div>
    </fieldset>
  );
}
