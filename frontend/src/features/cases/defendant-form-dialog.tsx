import { useId, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert, LoaderCircle } from "lucide-react";
import { Controller, FormProvider, useForm, useWatch, type FieldPath } from "react-hook-form";

import { FormSheet } from "@/components/forms/form-sheet";
import { FormSkeleton } from "@/components/forms/form-skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { FIRM_TIME_ZONE, todayIn } from "@/features/agenda/agenda-dates";
import { catalogOptionLabel } from "@/features/catalogs/catalog-format";
import { useCatalogOptions, useCatalogsSettled } from "@/features/catalogs/catalog-queries";
import type { AnyCatalogId } from "@/features/catalogs/catalog-types";
import { DEFENDANT_STATUS_LABELS } from "@/features/cases/case-format";
import { defendantProblem, personProblem } from "@/features/cases/case-form-errors";
import {
  CLOSED_STAGE,
  COUNSEL_NAME_MAX,
  defendantDataOf,
  defendantFormDefaults,
  defendantFormSchema,
  type DefendantFormValues,
} from "@/features/cases/case-form-schema";
import {
  useAddDefendant,
  useCreatePerson,
  useUpdateDefendant,
} from "@/features/cases/case-mutations";
import type { DefendantStatus, DefendantView } from "@/features/cases/case-types";
import { PersonFields } from "@/features/persons/person-fields";
import { newPersonOf } from "@/features/persons/person-schema";

const FORM_CATALOGS: AnyCatalogId[] = ["stages", "closing-outcomes"];
const STATUSES = Object.keys(DEFENDANT_STATUS_LABELS) as DefendantStatus[];

interface DefendantFormProps {
  caseId: string;
  /** Undefined to add one. */
  defendant?: DefendantView;
  onClose: () => void;
}

/**
 * "Agregá un imputado" (a person already in the firm or a new one) or "Editá al imputado": stage,
 * status, how it ended when closed, the formulation of charges and who defends them. The person
 * of a defendant never changes; rebellion and the other fields stay as they are.
 */
export function DefendantFormDialog({ caseId, defendant, onClose }: DefendantFormProps) {
  const adding = defendant === undefined;
  const formId = useId();
  const ready = useCatalogsSettled(FORM_CATALOGS);
  const today = todayIn(FIRM_TIME_ZONE);
  const stages = useCatalogOptions("stages", defendant?.stageCode);
  const outcomes = useCatalogOptions("closing-outcomes", defendant?.closingOutcomeCode);
  const createPerson = useCreatePerson();
  const add = useAddDefendant();
  const update = useUpdateDefendant(caseId);
  const [general, setGeneral] = useState<string | null>(null);

  const schema = useMemo(() => defendantFormSchema({ adding, today }), [adding, today]);
  const form = useForm<DefendantFormValues>({
    resolver: zodResolver(schema),
    defaultValues: defendantFormDefaults(defendant),
  });
  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = form;
  const status = useWatch({ control, name: "status" });
  const defendedByFirm = useWatch({ control, name: "defendedByFirm" });

  const markFields = (fields: Partial<Record<string, string>>, prefix = "") => {
    let first = true;
    for (const [field, message] of Object.entries(fields)) {
      if (!message) continue;
      setError(
        `${prefix}${field}` as FieldPath<DefendantFormValues>,
        { message },
        { shouldFocus: first },
      );
      first = false;
    }
  };

  const submit = handleSubmit(async (values) => {
    setGeneral(null);
    const data = defendantDataOf(values, defendant);
    if (!adding) {
      try {
        await update.mutateAsync({ defendantId: defendant.id, data });
        onClose();
      } catch (error) {
        const problem = defendantProblem(error);
        markFields(problem.fields);
        setGeneral(problem.general ?? null);
      }
      return;
    }

    let personId = values.person.personId;
    if (values.person.mode === "new") {
      try {
        const person = await createPerson.mutateAsync(newPersonOf(values.person));
        personId = person.id;
        setValue("person", {
          ...values.person,
          mode: "existing",
          personId,
          personName: person.displayName,
        });
      } catch (error) {
        const problem = personProblem(error);
        markFields(problem.fields, "person.");
        setGeneral(problem.general ?? null);
        return;
      }
    }
    try {
      await add.mutateAsync({ caseId, data: { personId, ...data } });
      onClose();
    } catch (error) {
      const problem = defendantProblem(error);
      markFields(problem.fields);
      setGeneral(problem.general ?? null);
    }
  });

  const ids = {
    stage: `${formId}-stage`,
    status: `${formId}-status`,
    outcome: `${formId}-outcome`,
    charges: `${formId}-charges`,
    counselKind: `${formId}-counselKind`,
    counselName: `${formId}-counselName`,
  };
  const closed = status === "CLOSED";

  return (
    <FormSheet
      title={adding ? "Agregá un imputado" : `Editá a ${defendant.displayName}`}
      description={
        adding ? "Buscá a la persona entre las del estudio o cargala si es nueva." : undefined
      }
      onClose={onClose}
      busy={!ready}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelá
          </Button>
          <Button type="submit" form={formId} disabled={!ready || isSubmitting}>
            {isSubmitting && <LoaderCircle aria-hidden="true" className="animate-spin" />}
            {adding ? "Agregá al imputado" : "Guardá los cambios"}
          </Button>
        </>
      }
    >
      {!ready ? (
        <FormSkeleton />
      ) : (
        <FormProvider {...form}>
          <form id={formId} noValidate onSubmit={submit} className="grid gap-6">
            {general && (
              <Alert variant="error" role="alert">
                <CircleAlert aria-hidden="true" />
                <AlertDescription>{general}</AlertDescription>
              </Alert>
            )}

            {adding && <PersonFields legend="¿Quién es?" />}

            <div className="grid items-start gap-4 sm:grid-cols-2">
              <Field>
                <Label htmlFor={ids.status}>Estado del proceso</Label>
                <Select id={ids.status} {...register("status")}>
                  {STATUSES.map((value) => (
                    <option key={value} value={value}>
                      {DEFENDANT_STATUS_LABELS[value]}
                    </option>
                  ))}
                </Select>
              </Field>
              {closed ? (
                <Field>
                  <Label htmlFor={ids.outcome}>Cómo terminó</Label>
                  <Select
                    id={ids.outcome}
                    aria-invalid={errors.closingOutcomeCode ? true : undefined}
                    aria-describedby={
                      errors.closingOutcomeCode ? `${ids.outcome}-error` : undefined
                    }
                    {...register("closingOutcomeCode")}
                  >
                    <option value="">Elegí el resultado</option>
                    {outcomes.items.map((item) => (
                      <option key={item.code} value={item.code}>
                        {catalogOptionLabel(item)}
                      </option>
                    ))}
                  </Select>
                  <FieldError id={`${ids.outcome}-error`}>
                    {errors.closingOutcomeCode?.message}
                  </FieldError>
                </Field>
              ) : (
                <Field>
                  <Label htmlFor={ids.stage}>Etapa</Label>
                  <Select
                    id={ids.stage}
                    aria-invalid={errors.stageCode ? true : undefined}
                    aria-describedby={errors.stageCode ? `${ids.stage}-error` : undefined}
                    {...register("stageCode")}
                  >
                    {stages.items
                      .filter((item) => item.code !== CLOSED_STAGE)
                      .map((item) => (
                        <option key={item.code} value={item.code}>
                          {catalogOptionLabel(item)}
                        </option>
                      ))}
                  </Select>
                  <FieldError id={`${ids.stage}-error`}>{errors.stageCode?.message}</FieldError>
                </Field>
              )}
            </div>
            {closed && (
              <p className="-mt-3 text-small text-muted-foreground">
                Un proceso cerrado pasa a la etapa «Cerrada».
              </p>
            )}

            <Field>
              <Label htmlFor={ids.charges}>Formulación de cargos</Label>
              <Input
                id={ids.charges}
                type="date"
                max={today}
                className="tabular-nums sm:max-w-60"
                aria-invalid={errors.chargesFormulatedOn ? true : undefined}
                aria-describedby={[
                  `${ids.charges}-hint`,
                  errors.chargesFormulatedOn ? `${ids.charges}-error` : null,
                ]
                  .filter(Boolean)
                  .join(" ")}
                {...register("chargesFormulatedOn")}
              />
              <FieldDescription id={`${ids.charges}-hint`}>
                Dejalo vacío si todavía no se formularon.
              </FieldDescription>
              <FieldError id={`${ids.charges}-error`}>
                {errors.chargesFormulatedOn?.message}
              </FieldError>
            </Field>

            <fieldset className="grid gap-3">
              <legend className="mb-1.5 text-body font-semibold">Defensa</legend>
              <Controller
                control={control}
                name="defendedByFirm"
                render={({ field }) => (
                  <div className="flex min-h-11 items-center gap-3">
                    <Checkbox
                      id={`${formId}-byFirm`}
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                    />
                    <Label htmlFor={`${formId}-byFirm`} className="cursor-pointer">
                      Lo defiende el estudio
                    </Label>
                  </div>
                )}
              />
              {!defendedByFirm && (
                <div className="grid items-start gap-4 sm:grid-cols-2">
                  <Field>
                    <Label htmlFor={ids.counselKind}>Tipo de defensa</Label>
                    <Select
                      id={ids.counselKind}
                      aria-invalid={errors.defenceCounselKind ? true : undefined}
                      aria-describedby={
                        errors.defenceCounselKind ? `${ids.counselKind}-error` : undefined
                      }
                      {...register("defenceCounselKind")}
                    >
                      <option value="PRIVATE">Particular</option>
                      <option value="PUBLIC">Defensa pública</option>
                    </Select>
                    <FieldError id={`${ids.counselKind}-error`}>
                      {errors.defenceCounselKind?.message}
                    </FieldError>
                  </Field>
                  <Field>
                    <Label htmlFor={ids.counselName}>Quién lo defiende</Label>
                    <Input
                      id={ids.counselName}
                      maxLength={COUNSEL_NAME_MAX}
                      autoComplete="off"
                      aria-invalid={errors.defenceCounselName ? true : undefined}
                      aria-describedby={
                        errors.defenceCounselName ? `${ids.counselName}-error` : undefined
                      }
                      {...register("defenceCounselName")}
                    />
                    <FieldError id={`${ids.counselName}-error`}>
                      {errors.defenceCounselName?.message}
                    </FieldError>
                  </Field>
                </div>
              )}
            </fieldset>
          </form>
        </FormProvider>
      )}
    </FormSheet>
  );
}
