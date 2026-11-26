import { useEffect, useId, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Archive,
  ArchiveRestore,
  CircleAlert,
  ExternalLink,
  Eye,
  LoaderCircle,
  Undo2,
} from "lucide-react";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { FIRM_TIME_ZONE, todayIn } from "@/features/agenda/agenda-dates";
import { LoadError } from "@/features/cases/case-states";
import {
  jusValueDataOf,
  jusValueProblem,
  jusValueSchema,
  type JusValueField,
  type JusValueValues,
} from "@/features/fees/fee-form-schema";
import { formatDay, formatPesos, formatPesosInput } from "@/features/fees/fee-format";
import { useCanManageJus } from "@/features/fees/fee-hooks";
import {
  useCreateJusValue,
  useFeeScale,
  useJusValues,
  useSetJusValueArchived,
} from "@/features/fees/fee-queries";
import type { JusValueView } from "@/features/fees/fee-types";
import { useAnnouncement } from "@/features/settings/settings-hooks";
import { SavedStatus, SettingsPage } from "@/features/settings/settings-layout";
import { isApiError, NETWORK_ERROR } from "@/lib/api";

/** Where the Poder Judicial publishes it, in case the scale cannot be read. */
const FALLBACK_JUS_SOURCE = "https://www.jusneuquen.gov.ar/valor-jus/";

/** "el valor de $ 94.963,25 desde el 01/07/2026", inside a sentence. */
function valueLabel(value: JusValueView): string {
  return `el valor de ${formatPesos(value.value)} desde el ${formatDay(value.validFrom)}`;
}

function archiveError(error: unknown, archiving: boolean): string {
  const what = archiving ? "archivó" : "restauró";
  if (isApiError(error)) {
    if (error.type === NETWORK_ERROR) {
      return `No hay conexión con el servidor, así que no se ${what} el valor. Revisá tu conexión y volvé a intentar.`;
    }
    if (error.type === "duplicate-jus-value") {
      return "No se puede restaurar: ya hay otro valor vigente desde ese mismo día. Archivá ese primero.";
    }
    if (error.status === 403) {
      return "Solo la persona titular y los abogados del estudio archivan o restauran valores del JUS.";
    }
    if (error.status === 404) {
      return "Ya no encontramos ese valor. Recargá la página para ver el historial al día.";
    }
  }
  return `El servidor no respondió como esperábamos y no se ${what} el valor. Volvé a intentar en unos minutos.`;
}

/**
 * `/ajustes/jus` (T50, ADR-0040): the JUS values the firm entered, newest first. The owner and
 * lawyers add one (a correction is a new value) or archive a wrong one; nothing is deleted. The
 * system never fetches the value: it links to the official source.
 */
export function JusValuesSection() {
  const canManage = useCanManageJus();
  const [showArchived, setShowArchived] = useState(false);
  const history = useJusValues(showArchived);
  const scale = useFeeScale();
  const jusSource = scale.data?.jusSource ?? FALLBACK_JUS_SOURCE;

  return (
    <SettingsPage
      section="/ajustes/jus"
      ownPermissions
      intro={
        <p>
          El JUS es la unidad de los honorarios de abogados en Neuquén (Ley 1594, art. 8). La
          calculadora de honorarios lo usa para pasar de JUS a pesos.
        </p>
      }
    >
      {!canManage && (
        <Alert className="max-w-3xl">
          <Eye aria-hidden="true" />
          <AlertDescription>
            Podés ver el valor y su historial. Lo cargan y lo archivan la persona titular y los
            abogados del estudio.
          </AlertDescription>
        </Alert>
      )}

      {history.isPending ? (
        <div className="grid max-w-3xl gap-4" role="status" aria-label="Cargando el valor del JUS">
          <Skeleton className="h-36 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      ) : history.isError ? (
        <div className="max-w-3xl">
          <LoadError
            title="No pudimos cargar el valor del JUS"
            error={history.error}
            onRetry={() => void history.refetch()}
          />
        </div>
      ) : (
        <>
          <CurrentValue current={history.data.current} jusSource={jusSource} />
          {canManage && <NewValueForm />}
          <History
            values={history.data.values}
            currentId={history.data.current?.id ?? null}
            canManage={canManage}
            showArchived={showArchived}
            onShowArchived={setShowArchived}
          />
        </>
      )}
    </SettingsPage>
  );
}

function CurrentValue({ current, jusSource }: { current: JusValueView | null; jusSource: string }) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className="grid max-w-3xl gap-3 rounded-xl border bg-card px-4 py-5 md:px-6"
    >
      <h2 id={titleId} className="text-meta font-semibold text-muted-foreground">
        Vigente hoy
      </h2>
      {current ? (
        <div className="grid gap-0.5">
          <p className="text-display font-bold tabular-nums">{formatPesos(current.value)}</p>
          <p className="text-body tabular-nums">
            Desde el <time dateTime={current.validFrom}>{formatDay(current.validFrom)}</time>
          </p>
        </div>
      ) : (
        <p className="max-w-prose text-body">
          Todavía no hay un valor vigente hoy. Sin él, la calculadora de honorarios no puede pasar
          de JUS a pesos.
        </p>
      )}
      <div className="grid gap-1 border-t pt-3">
        <a
          href={jusSource}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 w-fit items-center gap-1.5 text-meta font-semibold text-primary underline underline-offset-4 hover:decoration-2"
        >
          Mirá el valor oficial en el sitio del Poder Judicial
          <ExternalLink aria-hidden="true" className="size-4.5" />
          <span className="sr-only">(se abre en otra pestaña)</span>
        </a>
        <p className="max-w-prose text-meta text-muted-foreground">
          El sistema nunca lo busca solo: copialo de ahí con la fecha desde la que rige. Cada valor
          queda en el historial.
        </p>
      </div>
    </section>
  );
}

function NewValueForm() {
  const formId = useId();
  const create = useCreateJusValue();
  const [message, announce] = useAnnouncement();
  const [general, setGeneral] = useState<string | null>(null);
  const today = todayIn(FIRM_TIME_ZONE);

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    getValues,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<JusValueValues>({
    resolver: zodResolver(jusValueSchema),
    defaultValues: { value: "", validFrom: today },
  });

  const submit = handleSubmit(async (values) => {
    announce(null);
    setGeneral(null);
    try {
      const created = await create.mutateAsync(jusValueDataOf(values));
      reset({ value: "", validFrom: today });
      announce(
        `Guardado: el JUS de ${formatPesos(created.value)}, vigente desde el ${formatDay(created.validFrom)}.`,
      );
    } catch (error) {
      const problem = jusValueProblem(error);
      let first = true;
      for (const [field, text] of Object.entries(problem.fields)) {
        if (!text) continue;
        setError(field as JusValueField, { message: text }, { shouldFocus: first });
        first = false;
      }
      setGeneral(problem.general ?? null);
    }
  });

  const ids = {
    value: `${formId}-value`,
    validFrom: `${formId}-valid-from`,
    title: `${formId}-title`,
  };
  const valueField = register("value");

  return (
    <section
      aria-labelledby={ids.title}
      className="grid max-w-3xl gap-4 rounded-xl border bg-card px-4 py-5 md:px-6"
    >
      <h2 id={ids.title} className="text-title font-bold">
        Cargá un valor nuevo
      </h2>
      <form id={formId} noValidate onSubmit={submit} className="grid gap-5">
        {general && (
          <Alert variant="error" role="alert">
            <CircleAlert aria-hidden="true" />
            <AlertDescription>{general}</AlertDescription>
          </Alert>
        )}
        <div className="grid items-start gap-5 sm:grid-cols-2">
          <Field>
            <Label htmlFor={ids.value}>Valor del JUS</Label>
            <div className="relative">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-body text-muted-foreground"
              >
                $
              </span>
              <Input
                id={ids.value}
                inputMode="decimal"
                autoComplete="off"
                className="pl-8 tabular-nums"
                aria-invalid={errors.value ? true : undefined}
                aria-describedby={`${ids.value}-help${errors.value ? ` ${ids.value}-error` : ""}`}
                {...valueField}
                onBlur={(event) => {
                  void valueField.onBlur(event);
                  const value = getValues("value");
                  if (value) setValue("value", formatPesosInput(value));
                }}
              />
            </div>
            <FieldDescription id={`${ids.value}-help`}>
              En pesos, por ejemplo 94.963,25.
            </FieldDescription>
            <FieldError id={`${ids.value}-error`}>{errors.value?.message}</FieldError>
          </Field>
          <Field>
            <Label htmlFor={ids.validFrom}>Vigente desde</Label>
            <Input
              id={ids.validFrom}
              type="date"
              className="tabular-nums"
              aria-invalid={errors.validFrom ? true : undefined}
              aria-describedby={`${ids.validFrom}-help${errors.validFrom ? ` ${ids.validFrom}-error` : ""}`}
              {...register("validFrom")}
            />
            <FieldDescription id={`${ids.validFrom}-help`}>
              El día desde el que rige, según la resolución.
            </FieldDescription>
            <FieldError id={`${ids.validFrom}-error`}>{errors.validFrom?.message}</FieldError>
          </Field>
        </div>
        <Button type="submit" className="w-full sm:w-fit" disabled={isSubmitting}>
          {isSubmitting && (
            <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
          )}
          Guardá el valor
        </Button>
        <SavedStatus message={message} />
      </form>
    </section>
  );
}

/** Which button gets focus once a row changes: "Deshacé" after archiving, "Archivá" after undoing. */
type RowButton = "archive" | "undo" | "restore";
type FocusTarget = { id: string; button: RowButton } | null;

function History({
  values,
  currentId,
  canManage,
  showArchived,
  onShowArchived,
}: {
  values: JusValueView[];
  currentId: string | null;
  canManage: boolean;
  showArchived: boolean;
  onShowArchived: (show: boolean) => void;
}) {
  const baseId = useId();
  const setArchived = useSetJusValueArchived();
  /** Archived in this visit: they stay in place with "Deshacé" until the screen is left. */
  const [justArchived, setJustArchived] = useState<ReadonlyMap<string, JusValueView>>(new Map());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const focusTarget = useRef<FocusTarget>(null);
  const today = todayIn(FIRM_TIME_ZONE);

  const kept = [...justArchived.values()].filter(
    (archived) => !values.some((value) => value.id === archived.id),
  );
  const rows = [...values, ...kept].sort(
    (a, b) => b.validFrom.localeCompare(a.validFrom) || b.createdAt.localeCompare(a.createdAt),
  );

  const buttonId = (id: string, button: RowButton) => `${baseId}-${button}-${id}`;

  // Once the request settles and the row shows its new state (the refetched list can arrive a
  // render later), focus its button.
  useEffect(() => {
    const target = focusTarget.current;
    if (!target || busy) return;
    const button = document.getElementById(`${baseId}-${target.button}-${target.id}`);
    if (!button) return;
    button.focus();
    focusTarget.current = null;
  }, [baseId, busy, values, justArchived]);

  const toggle = async (value: JusValueView, archive: boolean, from: RowButton) => {
    setBusy(value.id);
    setError(null);
    setAnnouncement("");
    try {
      await setArchived.mutateAsync({ id: value.id, archived: archive });
      setJustArchived((current) => {
        const next = new Map(current);
        if (archive) next.set(value.id, { ...value, archived: true });
        else next.delete(value.id);
        return next;
      });
      setAnnouncement(
        archive
          ? `Archivaste ${valueLabel(value)}. Si fue sin querer, tocá Deshacé.`
          : `Restauraste ${valueLabel(value)}.`,
      );
      focusTarget.current = { id: value.id, button: archive ? "undo" : "archive" };
    } catch (failure) {
      setError(archiveError(failure, archive));
      focusTarget.current = { id: value.id, button: from };
    } finally {
      setBusy(null);
    }
  };

  const titleId = `${baseId}-title`;
  return (
    <section aria-labelledby={titleId} className="grid max-w-3xl gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <h2 id={titleId} className="text-title font-bold">
          Historial
        </h2>
        <div className="flex min-h-11 items-center gap-3">
          <Switch
            id={`${baseId}-archived`}
            checked={showArchived}
            onCheckedChange={onShowArchived}
          />
          <Label htmlFor={`${baseId}-archived`} className="cursor-pointer">
            Mostrá los archivados
          </Label>
        </div>
      </div>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      {error && (
        <Alert variant="error" role="alert">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>No se pudo hacer el cambio</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border-strong bg-card px-5 py-6 text-body text-muted-foreground">
          {canManage
            ? "Todavía no cargaste ningún valor del JUS. Copiá el vigente de la fuente oficial y cargalo arriba."
            : "Todavía no hay valores del JUS cargados."}
        </p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {rows.map((value) => {
            const undoable = justArchived.has(value.id);
            const isBusy = busy === value.id;
            const label = valueLabel(value);
            if (undoable) {
              return (
                <li
                  key={value.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 pr-2 pl-4 text-meta"
                >
                  <p className="min-w-0 flex-1 py-2 text-muted-foreground">Archivaste {label}.</p>
                  <Button
                    id={buttonId(value.id, "undo")}
                    variant="ghost"
                    className="px-3 text-primary"
                    disabled={isBusy}
                    onClick={() => void toggle(value, false, "undo")}
                  >
                    <Undo2 aria-hidden="true" />
                    Deshacé
                  </Button>
                </li>
              );
            }
            return (
              <li
                key={value.id}
                aria-label={`JUS de ${formatPesos(value.value)} desde el ${formatDay(value.validFrom)}`}
                className="flex items-center gap-x-3 px-4 py-3"
              >
                <div className="grid min-w-0 flex-1 gap-1">
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-body font-bold whitespace-nowrap tabular-nums">
                      {formatPesos(value.value)}
                    </span>
                    {value.archived ? (
                      <Badge variant="outline">Archivado</Badge>
                    ) : value.id === currentId ? (
                      <Badge variant="efectiva">Vigente hoy</Badge>
                    ) : value.validFrom > today ? (
                      <Badge variant="programada">Próximo</Badge>
                    ) : (
                      <Badge variant="neutral">Anterior</Badge>
                    )}
                  </p>
                  <p className="text-meta text-muted-foreground tabular-nums">
                    Desde el{" "}
                    <time dateTime={value.validFrom} className="whitespace-nowrap">
                      {formatDay(value.validFrom)}
                    </time>
                  </p>
                </div>
                {canManage &&
                  (value.archived ? (
                    <Button
                      id={buttonId(value.id, "restore")}
                      variant="ghost"
                      className="px-3 text-primary"
                      aria-label={`Restaurá ${label}`}
                      disabled={isBusy}
                      onClick={() => void toggle(value, false, "restore")}
                    >
                      <ArchiveRestore aria-hidden="true" />
                      Restaurá
                    </Button>
                  ) : (
                    <Button
                      id={buttonId(value.id, "archive")}
                      variant="ghost"
                      className="px-3 text-primary"
                      aria-label={`Archivá ${label}`}
                      disabled={isBusy}
                      onClick={() => void toggle(value, true, "archive")}
                    >
                      <Archive aria-hidden="true" />
                      Archivá
                    </Button>
                  ))}
              </li>
            );
          })}
        </ul>
      )}
      <p className="max-w-prose text-meta text-muted-foreground">
        Nada se borra: si cargaste un valor por error, archivalo y cargá el correcto.
      </p>
    </section>
  );
}
