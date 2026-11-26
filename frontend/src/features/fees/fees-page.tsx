import { useEffect, useId, useRef } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "@tanstack/react-router";
import { CircleAlert, Info, LoaderCircle } from "lucide-react";
import { Controller, useForm, useWatch, type UseFormRegisterReturn } from "react-hook-form";

import { FormSkeleton } from "@/components/forms/form-skeleton";
import { PageHeader } from "@/components/shell/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { FIRM_TIME_ZONE, todayIn } from "@/features/agenda/agenda-dates";
import { LoadError } from "@/features/cases/case-states";
import { reviewTags } from "@/features/catalogs/catalog-format";
import {
  calculationRequestOf,
  calculatorDefaults,
  calculatorSchema,
  FEE_INSTANCES,
  FEE_ROLES,
  isJusValueMissing,
  type CalculatorValues,
} from "@/features/fees/fee-form-schema";
import {
  formatJus,
  formatPercent,
  formatPesosInput,
  groupMinimums,
  INSTANCE_LABELS,
  instanceHint,
  jusSentence,
  minimumOptionLabel,
  ROLE_LABELS,
  roleHint,
} from "@/features/fees/fee-format";
import { useCanManageJus } from "@/features/fees/fee-hooks";
import { useCalculateFee, useFeeScale, useJusValues } from "@/features/fees/fee-queries";
import {
  FeeResult,
  FeeResultPlaceholder,
  JusMissing,
} from "@/features/fees/fee-result";
import type { FeeScaleView } from "@/features/fees/fee-types";
import { DEFAULT_AREA } from "@/features/practice-areas/practice-area-format";
import { useAreaDirectory } from "@/features/practice-areas/practice-area-queries";
import { isApiError, NETWORK_ERROR } from "@/lib/api";

const radioCard =
  "flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border bg-card px-3.5 py-3 transition-colors duration-fast ease-out hover:bg-accent has-checked:border-primary has-checked:bg-accent has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring";

/** One radio card per choice, with a line of help from the scale. */
function RadioCards<T extends string>({
  legend,
  options,
  field,
}: {
  legend: string;
  options: { value: T; label: string; hint: string }[];
  field: UseFormRegisterReturn;
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1.5 text-body font-semibold">{legend}</legend>
      <div className="grid gap-2">
        {options.map((option) => (
          <label key={option.value} className={radioCard}>
            <input
              type="radio"
              value={option.value}
              className="mt-1 size-4.5 shrink-0 accent-primary focus-visible:outline-none"
              {...field}
            />
            <span className="grid min-w-0 gap-0.5">
              <span className="text-body font-semibold">{option.label}</span>
              {option.hint && (
                <span className="text-small text-muted-foreground">{option.hint}</span>
              )}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function startingArea(areas: { code: string }[]): string {
  return areas.some((area) => area.code === DEFAULT_AREA) ? DEFAULT_AREA : (areas[0]?.code ?? "");
}

function calculationError(error: unknown): string {
  if (isApiError(error) && error.type === NETWORK_ERROR) {
    return "No hay conexión con el servidor, así que no pudimos calcular. Revisá tu conexión a internet y volvé a intentar.";
  }
  if (isApiError(error) && error.status === 400) {
    return "Revisá los datos: el servidor no los pudo usar para calcular.";
  }
  return "El servidor no respondió como esperábamos y no pudimos calcular. Volvé a intentar en unos minutos.";
}

/**
 * `/honorarios` (T50, ADR-0040): an assisted estimate of a fee under the Ley 1594, in pesos and
 * in JUS, with every step and its article. Nothing is stored; the judge sets the fee.
 */
export function FeesPage() {
  const scale = useFeeScale();
  const jus = useJusValues();
  const canManage = useCanManageJus();
  const { areas } = useAreaDirectory();

  const noJusAtAll = jus.isSuccess && jus.data.values.length === 0;
  // Without the firm's areas (still loading or failed), the default one: penal.
  const firmAreas = areas.length > 0 ? areas : [{ code: DEFAULT_AREA, name: "Penal" }];

  return (
    <>
      <PageHeader title="Honorarios">
        <p className="max-w-prose">
          Estimá el honorario de un asunto según la Ley 1594 de Neuquén, en pesos y en JUS, con
          cada paso y su artículo.
        </p>
      </PageHeader>

      {scale.isError ? (
        <LoadError
          title="No pudimos cargar la escala de honorarios"
          error={scale.error}
          onRetry={() => void scale.refetch()}
        />
      ) : scale.isPending ? (
        <div className="max-w-2xl rounded-xl border bg-card p-4">
          <FormSkeleton />
        </div>
      ) : (
        <Calculator
          scale={scale.data}
          areas={firmAreas}
          canManage={canManage}
          currentJus={jus.data?.current ?? null}
          noJusAtAll={noJusAtAll}
        />
      )}
    </>
  );
}

function Calculator({
  scale,
  areas,
  canManage,
  currentJus,
  noJusAtAll,
}: {
  scale: FeeScaleView;
  areas: { code: string; name: string }[];
  canManage: boolean;
  currentJus: { value: number; validFrom: string } | null;
  noJusAtAll: boolean;
}) {
  const formId = useId();
  const calculate = useCalculateFee();
  const resultRef = useRef<HTMLHeadingElement>(null);
  const today = todayIn(FIRM_TIME_ZONE);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    getValues,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CalculatorValues>({
    resolver: zodResolver(calculatorSchema),
    // With several areas the list starts filtered to the default one (penal) or the first.
    defaultValues: calculatorDefaults(today, areas.length > 1 ? startingArea(areas) : ""),
  });

  const area = useWatch({ control, name: "area" });
  const minimumCode = useWatch({ control, name: "minimumCode" });
  const amount = useWatch({ control, name: "amount" });
  const groups = groupMinimums(scale.minimums, areas, area);
  const chosen = scale.minimums.find((minimum) => minimum.code === minimumCode);
  /** The request of the answer on screen (the mutation keeps it with the answer). */
  const submitted = calculate.variables;

  const areaField = register("area", {
    // The area filter can hide the chosen kind of matter: then nothing is chosen.
    onChange: (event: { target: { value: string } }) => {
      const code = getValues("minimumCode");
      const visible = groupMinimums(scale.minimums, areas, event.target.value).some((group) =>
        group.minimums.some((minimum) => minimum.code === code),
      );
      if (!visible) setValue("minimumCode", "");
    },
  });

  // A new result takes the reader to it (on phones it is below the form).
  useEffect(() => {
    if (calculate.data) resultRef.current?.focus();
  }, [calculate.data]);

  const submit = handleSubmit(async (values) => {
    try {
      await calculate.mutateAsync(calculationRequestOf(values));
    } catch (error) {
      if (isApiError(error) && error.type === "invalid-fee-data") {
        setError(
          "minimumCode",
          { message: "Ese tipo de asunto ya no está en la escala. Recargá la página y elegí otro." },
          { shouldFocus: true },
        );
      }
    }
  });

  const ids = {
    area: `${formId}-area`,
    minimum: `${formId}-minimum`,
    amount: `${formId}-amount`,
    lost: `${formId}-lost`,
    date: `${formId}-date`,
  };
  const amountField = register("amount");
  const lostFloor = formatPercent(scale.scale.minPercent * scale.scale.losingPartyFloorFactor);

  let result;
  if (calculate.isError && isJusValueMissing(calculate.error)) {
    result = <JusMissing canManage={canManage} day={submitted?.date} />;
  } else if (noJusAtAll && !calculate.data) {
    result = <JusMissing canManage={canManage} />;
  } else if (calculate.data && submitted && !calculate.isError) {
    result = (
      <FeeResult
        result={calculate.data}
        request={submitted}
        lawSource={scale.source}
        headingRef={resultRef}
      />
    );
  } else {
    result = <FeeResultPlaceholder />;
  }

  return (
    <div className="grid gap-7 lg:grid-cols-2 lg:items-start lg:gap-x-10">
      <form
        id={formId}
        noValidate
        onSubmit={submit}
        aria-label="Datos del asunto"
        className="grid min-w-0 gap-6 rounded-xl border bg-card px-4 py-5 md:px-6"
      >
        {areas.length > 1 && (
          <Field>
            <Label htmlFor={ids.area}>Fuero</Label>
            <Select id={ids.area} {...areaField}>
              <option value="">Todos los fueros</option>
              {areas.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.name}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Field>
          <Label htmlFor={ids.minimum}>Tipo de asunto</Label>
          <Select
            id={ids.minimum}
            aria-invalid={errors.minimumCode ? true : undefined}
            aria-describedby={`${ids.minimum}-help${errors.minimumCode ? ` ${ids.minimum}-error` : ""}`}
            {...register("minimumCode")}
          >
            <option value="">Elegí el tipo de asunto</option>
            {groups.map((group) => (
              <optgroup key={group.area || "all"} label={group.label}>
                {group.minimums.map((minimum) => (
                  <option key={minimum.code} value={minimum.code}>
                    {minimumOptionLabel(minimum)}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
          <FieldDescription id={`${ids.minimum}-help`}>
            {chosen
              ? `Mínimo de ${formatJus(chosen.jus)} JUS (Ley 1594, ${chosen.article}) ${reviewTags(chosen.flags)}`.trim()
              : "Cada tipo tiene un mínimo en JUS (Ley 1594, art. 9)."}
          </FieldDescription>
          {chosen?.note && (
            <p className="flex max-w-prose items-start gap-2 text-small text-muted-foreground">
              <Info aria-hidden="true" className="mt-0.5 size-4.5 shrink-0" />
              <span>{chosen.note}</span>
            </p>
          )}
          <FieldError id={`${ids.minimum}-error`}>{errors.minimumCode?.message}</FieldError>
        </Field>

        <Field>
          <Label htmlFor={ids.amount}>Monto del proceso</Label>
          <div className="relative">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-body text-muted-foreground"
            >
              $
            </span>
            <Input
              id={ids.amount}
              inputMode="decimal"
              autoComplete="off"
              className="pl-8 tabular-nums"
              aria-invalid={errors.amount ? true : undefined}
              aria-describedby={`${ids.amount}-help${errors.amount ? ` ${ids.amount}-error` : ""}`}
              {...amountField}
              onBlur={(event) => {
                void amountField.onBlur(event);
                const value = getValues("amount");
                if (value) setValue("amount", formatPesosInput(value), { shouldValidate: true });
              }}
            />
          </div>
          <FieldDescription id={`${ids.amount}-help`}>
            Opcional, en pesos (por ejemplo 1.500.000,50). Dejalo vacío si el asunto no se puede
            medir en dinero: se usa el mínimo.
          </FieldDescription>
          <FieldError id={`${ids.amount}-error`}>{errors.amount?.message}</FieldError>
        </Field>

        <Field>
          <div className="flex min-h-11 items-center gap-3">
            <Controller
              control={control}
              name="clientLostEntirely"
              render={({ field }) => (
                <Switch
                  id={ids.lost}
                  checked={field.value && amount !== ""}
                  disabled={amount === ""}
                  onCheckedChange={field.onChange}
                  onBlur={field.onBlur}
                  aria-describedby={`${ids.lost}-help`}
                />
              )}
            />
            <Label htmlFor={ids.lost} className="cursor-pointer">
              Tu cliente perdió todo
            </Label>
          </div>
          <FieldDescription id={`${ids.lost}-help`}>
            {amount === ""
              ? "Solo cambia el cálculo cuando hay monto."
              : `La escala arranca en el ${lostFloor}% en vez del ${formatPercent(scale.scale.minPercent)}% (Ley 1594, ${scale.scale.article}).`}
          </FieldDescription>
        </Field>

        <RadioCards
          legend="Tu rol"
          field={register("role")}
          options={FEE_ROLES.map((role) => ({
            value: role,
            label: ROLE_LABELS[role],
            hint: roleHint(role, scale),
          }))}
        />

        <RadioCards
          legend="Instancia"
          field={register("instance")}
          options={FEE_INSTANCES.map((instance) => ({
            value: instance,
            label: INSTANCE_LABELS[instance],
            hint: instanceHint(instance, scale),
          }))}
        />

        <Field>
          <Label htmlFor={ids.date}>Fecha del valor del JUS</Label>
          <Input
            id={ids.date}
            type="date"
            className="tabular-nums sm:max-w-60"
            aria-invalid={errors.date ? true : undefined}
            aria-describedby={`${ids.date}-help${errors.date ? ` ${ids.date}-error` : ""}`}
            {...register("date")}
          />
          <FieldDescription id={`${ids.date}-help`}>
            Se usa el JUS vigente ese día.
            {currentJus && ` Hoy rige el ${jusSentence(currentJus)}.`}{" "}
            {canManage && (
              <Link
                to="/ajustes/jus"
                className="font-semibold text-primary underline underline-offset-4 hover:decoration-2"
              >
                Mirá el historial
              </Link>
            )}
          </FieldDescription>
          <FieldError id={`${ids.date}-error`}>{errors.date?.message}</FieldError>
        </Field>

        <Button type="submit" size="lg" className="w-full sm:w-fit" disabled={isSubmitting}>
          {isSubmitting && (
            <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
          )}
          Calculá el honorario
        </Button>
      </form>

      <div className="grid min-w-0 gap-4 lg:sticky lg:top-10">
        {calculate.isError && !isJusValueMissing(calculate.error) && (
          <Alert variant="error" role="alert">
            <CircleAlert aria-hidden="true" />
            <AlertDescription>{calculationError(calculate.error)}</AlertDescription>
          </Alert>
        )}
        {result}
      </div>
    </div>
  );
}
