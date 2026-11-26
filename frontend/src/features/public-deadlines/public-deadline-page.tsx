import { useEffect, useId, useMemo, useRef } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "@tanstack/react-router";
import { CircleAlert, LoaderCircle, LogIn } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";

import { FormSkeleton } from "@/components/forms/form-skeleton";
import { BrandMark } from "@/components/shell/brand-mark";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { FIRM_TIME_ZONE, todayIn } from "@/features/agenda/agenda-dates";
import { LOGIN_PATH } from "@/features/auth/redirect";
import {
  calculationErrorMessage,
  dueSentence,
  lowerFirst,
  PUBLIC_CALCULATOR_PATH,
  ruleOptionLabel,
  THROTTLED,
  THROTTLED_MESSAGE,
} from "@/features/public-deadlines/public-deadline-format";
import {
  usePublicCalculation,
  usePublicRules,
} from "@/features/public-deadlines/public-deadline-queries";
import {
  PublicDeadlineResult,
  PublicResultPlaceholder,
  RuleSummary,
} from "@/features/public-deadlines/public-deadline-result";
import {
  publicCalculationRequestOf,
  publicCalculatorSchema,
  type PublicCalculatorValues,
} from "@/features/public-deadlines/public-deadline-schema";
import type { PublicRule } from "@/features/public-deadlines/public-deadline-types";
import { isApiError, NETWORK_ERROR } from "@/lib/api";

const PAGE_TITLE = "Calculadora de plazos del CPP de Neuquén | Gestor de causas penales";

/** Sets the tab title while the page is open and puts the previous one back on the way out. */
function useDocumentTitle(title: string) {
  useEffect(() => {
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);
}

/**
 * `/calculadora-de-plazos` (T51, ADR-0041): public, no session. Computes a CPP Neuquén deadline
 * with the built-in engine and court calendar. Nothing typed here is stored.
 */
export function PublicDeadlinePage() {
  useDocumentTitle(PAGE_TITLE);
  const rules = usePublicRules();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto flex w-full max-w-content items-center justify-between gap-3 px-4 py-2.5 sm:px-8 lg:px-10">
          <Link to={PUBLIC_CALCULATOR_PATH} className="rounded-lg">
            <BrandMark />
          </Link>
          <Button asChild variant="outline">
            <Link to={LOGIN_PATH}>
              <LogIn aria-hidden="true" />
              Ingresá
            </Link>
          </Button>
        </div>
      </header>

      <main
        id="contenido"
        className="mx-auto grid w-full max-w-content flex-1 content-start gap-8 px-4 pt-7 pb-12 sm:px-8 lg:gap-10 lg:px-10 lg:pt-10"
      >
        <div className="grid max-w-3xl gap-3">
          <h1 className="text-display font-bold text-balance">
            Calculadora de plazos del CPP de Neuquén
          </h1>
          <p className="max-w-prose text-body text-muted-foreground">
            Elegí el plazo y la fecha desde la que corre: te decimos cuándo vence, con el artículo
            de la Ley 2784 y el calendario judicial de Neuquén. Es gratis y no hace falta cuenta.
          </p>
        </div>

        {rules.isError ? (
          <RulesError error={rules.error} onRetry={() => void rules.refetch()} />
        ) : rules.isPending ? (
          <div
            role="status"
            aria-busy="true"
            aria-label="Cargando los plazos"
            className="max-w-2xl rounded-xl border bg-card p-4"
          >
            <FormSkeleton />
          </div>
        ) : (
          <Calculator rules={rules.data} />
        )}

        <LawyerInvitation />
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-content flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-8 lg:px-10">
          <p className="max-w-prose text-small text-muted-foreground">
            Herramienta de asistencia: el sistema calcula, el abogado controla. No guardamos los
            datos que cargás.
          </p>
          <ThemeToggle />
        </div>
      </footer>
    </div>
  );
}

function RulesError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const throttled = isApiError(error) && error.type === THROTTLED;
  const offline = isApiError(error) && error.type === NETWORK_ERROR;
  return (
    <Alert variant="error" role="alert" className="max-w-2xl">
      <CircleAlert aria-hidden="true" />
      <AlertTitle>No pudimos cargar los plazos</AlertTitle>
      <AlertDescription>
        <p>
          {throttled
            ? THROTTLED_MESSAGE
            : offline
              ? "No hay conexión con el servidor. Revisá tu conexión a internet y volvé a intentar."
              : "El servidor no respondió como esperábamos. Volvé a intentar en unos minutos."}
        </p>
        <Button variant="outline" className="mt-2 justify-self-start" onClick={onRetry}>
          Volvé a intentar
        </Button>
      </AlertDescription>
    </Alert>
  );
}

/** The call to action of the marketing entry point: the full product, for a firm's lawyers. */
function LawyerInvitation() {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className="grid max-w-3xl gap-3 rounded-xl border bg-card px-4 py-5 md:px-6"
    >
      <h2 id={titleId} className="text-title font-bold text-balance">
        ¿Sos abogado o abogada de un estudio?
      </h2>
      <p className="max-w-prose text-body text-muted-foreground">
        En el gestor cada plazo queda en su causa, se cuenta solo y te avisa antes de que venza,
        junto con la agenda de audiencias del día y las alertas de tus defendidos detenidos.
      </p>
      <Button asChild size="lg" className="w-full justify-self-start sm:w-fit">
        <Link to={LOGIN_PATH}>Ingresá a tu estudio</Link>
      </Button>
    </section>
  );
}

/** Scrolls only when the result starts off screen or low on it (phones), never beside the form. */
function scrollIntoViewIfHidden(element: HTMLElement | null) {
  if (!element) return;
  const { top } = element.getBoundingClientRect();
  if (top >= 0 && top < window.innerHeight / 2) return;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  element.scrollIntoView?.({ block: "start", behavior: reduce ? "auto" : "smooth" });
}

function Calculator({ rules }: { rules: PublicRule[] }) {
  const formId = useId();
  const calculate = usePublicCalculation();
  const resultRef = useRef<HTMLDivElement>(null);
  const schema = useMemo(() => publicCalculatorSchema(rules), [rules]);
  const detained = rules.filter((rule) => rule.detainee);
  const others = rules.filter((rule) => !rule.detainee);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<PublicCalculatorValues>({
    resolver: zodResolver(schema),
    defaultValues: { rule: "", startDate: todayIn(FIRM_TIME_ZONE), startTime: "" },
  });

  const ruleCode = useWatch({ control, name: "rule" });
  const chosen = rules.find((rule) => rule.code === ruleCode);
  const inHours = chosen?.computation === "HOURS";

  // On phones the result is below the form: bring it into view without moving the focus.
  useEffect(() => {
    if (calculate.data) scrollIntoViewIfHidden(resultRef.current);
  }, [calculate.data]);

  const submit = handleSubmit(async (values) => {
    try {
      await calculate.mutateAsync(publicCalculationRequestOf(values, chosen));
    } catch {
      // The error is on screen (calculate.error).
    }
  });

  const ids = {
    rule: `${formId}-rule`,
    date: `${formId}-date`,
    time: `${formId}-time`,
  };
  const describedBy = (id: string, hasError: boolean, extra?: string) =>
    [extra, `${id}-help`, hasError ? `${id}-error` : undefined].filter(Boolean).join(" ");

  return (
    <div className="grid gap-7 lg:grid-cols-2 lg:items-start lg:gap-x-10">
      <form
        noValidate
        onSubmit={submit}
        aria-label="Datos del plazo"
        className="grid min-w-0 gap-6 rounded-xl border bg-card px-4 py-5 md:px-6"
      >
        <Field>
          <Label htmlFor={ids.rule}>Plazo</Label>
          <Select
            id={ids.rule}
            aria-invalid={errors.rule ? true : undefined}
            aria-describedby={describedBy(
              ids.rule,
              Boolean(errors.rule),
              chosen ? `${ids.rule}-summary` : undefined,
            )}
            {...register("rule")}
          >
            <option value="">Elegí el plazo</option>
            {detained.length > 0 && (
              <optgroup label="Personas detenidas">
                {detained.map((rule) => (
                  <option key={rule.code} value={rule.code}>
                    {ruleOptionLabel(rule)}
                  </option>
                ))}
              </optgroup>
            )}
            {others.length > 0 && (
              <optgroup label="Otros plazos">
                {others.map((rule) => (
                  <option key={rule.code} value={rule.code}>
                    {ruleOptionLabel(rule)}
                  </option>
                ))}
              </optgroup>
            )}
          </Select>
          <FieldDescription id={`${ids.rule}-help`}>
            Los plazos legales del CPP de Neuquén que se cuentan solos. Los que fija el juez o la
            fiscalía no están.
          </FieldDescription>
          <FieldError id={`${ids.rule}-error`}>{errors.rule?.message}</FieldError>
          {chosen && <RuleSummary rule={chosen} id={`${ids.rule}-summary`} />}
        </Field>

        <div className="grid gap-6 sm:grid-cols-2 sm:items-start">
          <Field>
            <Label htmlFor={ids.date}>Fecha de inicio</Label>
            <Input
              id={ids.date}
              type="date"
              className="tabular-nums"
              aria-invalid={errors.startDate ? true : undefined}
              aria-describedby={describedBy(ids.date, Boolean(errors.startDate))}
              {...register("startDate")}
            />
            <FieldDescription id={`${ids.date}-help`}>
              {chosen
                ? `El día en que empieza a correr: ${lowerFirst(chosen.trigger)}.`
                : "El día en que empieza a correr el plazo."}
            </FieldDescription>
            <FieldError id={`${ids.date}-error`}>{errors.startDate?.message}</FieldError>
          </Field>

          {inHours && (
            <Field>
              <Label htmlFor={ids.time}>Hora de inicio</Label>
              <Input
                id={ids.time}
                type="time"
                className="tabular-nums"
                aria-invalid={errors.startTime ? true : undefined}
                aria-describedby={describedBy(ids.time, Boolean(errors.startTime))}
                {...register("startTime")}
              />
              <FieldDescription id={`${ids.time}-help`}>
                Hora de Neuquén. Este plazo corre en horas.
              </FieldDescription>
              <FieldError id={`${ids.time}-error`}>{errors.startTime?.message}</FieldError>
            </Field>
          )}
        </div>

        <Button type="submit" size="lg" className="w-full sm:w-fit" disabled={isSubmitting}>
          {isSubmitting && (
            <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
          )}
          Calculá el vencimiento
        </Button>
      </form>

      <div ref={resultRef} className="grid min-w-0 scroll-mt-4 gap-4 lg:sticky lg:top-10">
        <p role="status" className="sr-only">
          {calculate.data && !calculate.isError ? dueSentence(calculate.data) : ""}
        </p>
        {calculate.isError && (
          <Alert variant="error" role="alert">
            <CircleAlert aria-hidden="true" />
            <AlertDescription>{calculationErrorMessage(calculate.error)}</AlertDescription>
          </Alert>
        )}
        {calculate.data && !calculate.isError ? (
          <PublicDeadlineResult calculation={calculate.data} />
        ) : (
          <PublicResultPlaceholder />
        )}
      </div>
    </div>
  );
}
