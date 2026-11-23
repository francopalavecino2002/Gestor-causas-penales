import { useId, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "@tanstack/react-router";
import { CircleAlert, Info, LoaderCircle } from "lucide-react";
import { Controller, FormProvider, useForm, useWatch, type FieldPath } from "react-hook-form";

import { FormSheet } from "@/components/forms/form-sheet";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useMe } from "@/features/auth/me-query";
import { catalogOptionLabel } from "@/features/catalogs/catalog-format";
import { useCatalogOptions, useCatalogsSettled } from "@/features/catalogs/catalog-queries";
import type { AnyCatalogId } from "@/features/catalogs/catalog-types";
import { FormSkeleton } from "@/components/forms/form-skeleton";
import { ACTION_TYPE_LABELS, REPRESENTATION_LABELS } from "@/features/cases/case-format";
import {
  CAPTION_MAX,
  caseDataOf,
  caseFormDefaults,
  caseFormSchema,
  CLOSED_STAGE,
  defendantDataOf,
  defendantFormDefaults,
  NUMBER_MAX,
  type CaseFormValues,
} from "@/features/cases/case-form-schema";
import {
  caseFormProblem,
  defendantProblem,
  personProblem,
} from "@/features/cases/case-form-errors";
import {
  useAddDefendant,
  useCreateCase,
  useCreatePerson,
  useUpdateCase,
} from "@/features/cases/case-mutations";
import type { ActionType, CaseDetail, Representation } from "@/features/cases/case-types";
import { canBeResponsible, useFirmMembers } from "@/features/members/member-queries";
import { PersonFields } from "@/features/persons/person-fields";
import { newPersonOf } from "@/features/persons/person-schema";

/** Wait for them so the selects show the saved value from the first render. */
const FORM_CATALOGS: AnyCatalogId[] = ["circumscriptions", "stages"];

const ACTION_TYPES = Object.keys(ACTION_TYPE_LABELS) as ActionType[];
const REPRESENTATIONS = Object.keys(REPRESENTATION_LABELS) as Representation[];

/** A text field of the form, with its label, hint and error wired for screen readers. */
function TextField({
  form,
  name,
  label,
  hint,
  maxLength,
  className,
  numeric = false,
}: {
  form: ReturnType<typeof useForm<CaseFormValues>>;
  name: "caption" | "internalNumber" | "mpfLegajo" | "ofijuNumber" | "pehuenNumber";
  label: string;
  hint?: string;
  maxLength: number;
  className?: string;
  numeric?: boolean;
}) {
  const id = useId();
  const error = form.formState.errors[name]?.message;
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(" ");
  return (
    <Field className={className}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        maxLength={maxLength}
        autoComplete="off"
        className={numeric ? "tabular-nums" : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        {...form.register(name)}
      />
      {hint && <FieldDescription id={`${id}-hint`}>{hint}</FieldDescription>}
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </Field>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <h3 className="text-card-title font-bold">{children}</h3>;
}

interface CaseFormProps {
  detail?: CaseDetail;
  canChangeReserved?: boolean;
  onClose: () => void;
}

/**
 * "Nueva causa" (`detail` undefined) or "Editá la causa". A new case can bring its first
 * defendant: the new person (if any) is created first, then the case, then the defendant; after
 * saving, the new case opens. The team and the custom fields are not changed here.
 */
export function CaseFormDialog({ detail, canChangeReserved = true, onClose }: CaseFormProps) {
  const creating = detail === undefined;
  const formId = useId();
  const ready = useCatalogsSettled(FORM_CATALOGS);
  const navigate = useNavigate();
  const { data: me } = useMe();
  const meCanBeResponsible = me ? canBeResponsible(me) : false;
  const members = useFirmMembers();
  const circumscriptions = useCatalogOptions("circumscriptions", detail?.circumscriptionCode);
  const stages = useCatalogOptions("stages");

  const createCase = useCreateCase();
  const updateCase = useUpdateCase(detail?.id ?? "");
  const createPerson = useCreatePerson();
  const addDefendant = useAddDefendant();
  const [general, setGeneral] = useState<string | null>(null);
  /** The case was saved but its first defendant was not. */
  const [partial, setPartial] = useState<{ caseId: string; message: string } | null>(null);

  const schema = useMemo(
    () => caseFormSchema({ requireResponsible: !meCanBeResponsible, creating }),
    [meCanBeResponsible, creating],
  );
  const form = useForm<CaseFormValues>({
    resolver: zodResolver(schema),
    defaultValues: caseFormDefaults(detail),
  });
  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = form;
  const withDefendant = useWatch({ control, name: "withDefendant" });

  const responsibleOptions = (members.data ?? []).filter(
    (member) => canBeResponsible(member) && member.id !== me?.id,
  );

  const markFields = (fields: Partial<Record<string, string>>, prefix = "") => {
    let first = true;
    for (const [field, message] of Object.entries(fields)) {
      if (!message) continue;
      setError(
        `${prefix}${field}` as FieldPath<CaseFormValues>,
        { message },
        { shouldFocus: first },
      );
      first = false;
    }
  };

  const submit = handleSubmit(async (values) => {
    setGeneral(null);
    if (!creating) {
      try {
        await updateCase.mutateAsync(caseDataOf(values, false));
        onClose();
      } catch (error) {
        const problem = caseFormProblem(error);
        markFields(problem.fields);
        setGeneral(problem.general ?? null);
      }
      return;
    }

    let personId = values.person.personId;
    let personName = values.person.personName;
    if (values.withDefendant && values.person.mode === "new") {
      try {
        const person = await createPerson.mutateAsync(newPersonOf(values.person));
        personId = person.id;
        personName = person.displayName;
        // Saved: a second try must not create the person again.
        setValue("person", { ...values.person, mode: "existing", personId, personName });
      } catch (error) {
        const problem = personProblem(error);
        markFields(problem.fields, "person.");
        setGeneral(problem.general ?? null);
        return;
      }
    }

    let created: CaseDetail;
    try {
      created = await createCase.mutateAsync(caseDataOf(values, true));
    } catch (error) {
      const problem = caseFormProblem(error);
      markFields(problem.fields);
      setGeneral(problem.general ?? null);
      return;
    }

    if (values.withDefendant) {
      try {
        await addDefendant.mutateAsync({
          caseId: created.id,
          data: {
            personId,
            ...defendantDataOf({ ...defendantFormDefaults(), stageCode: values.stageCode }),
          },
        });
      } catch (error) {
        const problem = defendantProblem(error);
        const reason = problem.general ?? Object.values(problem.fields)[0] ?? "";
        setPartial({
          caseId: created.id,
          message: `La causa quedó guardada, pero no pudimos sumar a ${personName} como imputado. ${reason}`,
        });
        return;
      }
    }
    onClose();
    void navigate({ to: "/causas/$caseId", params: { caseId: created.id } });
  });

  if (partial) {
    return (
      <FormSheet
        title="La causa se guardó"
        onClose={onClose}
        footer={
          <Button
            onClick={() => {
              onClose();
              void navigate({ to: "/causas/$caseId", params: { caseId: partial.caseId } });
            }}
          >
            Abrí la causa
          </Button>
        }
      >
        <Alert variant="error" role="alert">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>Falta el imputado</AlertTitle>
          <AlertDescription>
            {partial.message} Abrí la causa y agregalo desde «Imputados».
          </AlertDescription>
        </Alert>
      </FormSheet>
    );
  }

  const fieldIds = {
    circumscription: `${formId}-circumscription`,
    actionType: `${formId}-actionType`,
    responsible: `${formId}-responsible`,
    stage: `${formId}-stage`,
  };

  return (
    <FormSheet
      title={creating ? "Nueva causa" : "Editá la causa"}
      description={
        creating
          ? "Con la carátula y la circunscripción alcanza para empezar; el resto lo completás cuando lo tengas."
          : undefined
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
            {creating ? "Guardá la causa" : "Guardá los cambios"}
          </Button>
        </>
      }
    >
      {!ready ? (
        <FormSkeleton />
      ) : (
        <FormProvider {...form}>
          <form id={formId} noValidate onSubmit={submit} className="grid gap-7">
            {general && (
              <Alert variant="error" role="alert">
                <CircleAlert aria-hidden="true" />
                <AlertDescription>{general}</AlertDescription>
              </Alert>
            )}

            <section className="grid gap-4">
              <SectionTitle>Datos de la causa</SectionTitle>
              <TextField
                form={form}
                name="caption"
                label="Carátula"
                hint="Como figura en el legajo, por ejemplo «Modelo, Carla s/ robo» (datos ficticios)."
                maxLength={CAPTION_MAX}
              />
              <div className="grid items-start gap-4 sm:grid-cols-2">
                <Field>
                  <Label htmlFor={fieldIds.circumscription}>Circunscripción</Label>
                  <Select
                    id={fieldIds.circumscription}
                    aria-invalid={errors.circumscriptionCode ? true : undefined}
                    aria-describedby={
                      errors.circumscriptionCode ? `${fieldIds.circumscription}-error` : undefined
                    }
                    disabled={circumscriptions.isPending}
                    {...register("circumscriptionCode")}
                  >
                    <option value="">
                      {circumscriptions.isPending ? "Cargando…" : "Elegí la circunscripción"}
                    </option>
                    {circumscriptions.items.map((item) => (
                      <option key={item.code} value={item.code}>
                        {catalogOptionLabel(item)}
                      </option>
                    ))}
                  </Select>
                  <FieldError id={`${fieldIds.circumscription}-error`}>
                    {errors.circumscriptionCode?.message ??
                      (circumscriptions.isError
                        ? "No pudimos cargar las circunscripciones. Cerrá y volvé a abrir el formulario."
                        : undefined)}
                  </FieldError>
                </Field>
                <Field>
                  <Label htmlFor={fieldIds.actionType}>Tipo de acción</Label>
                  <Select id={fieldIds.actionType} {...register("actionType")}>
                    {ACTION_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {ACTION_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <fieldset className="grid gap-2">
                <legend className="mb-1.5 text-body font-semibold">El estudio representa a</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {REPRESENTATIONS.map((side) => (
                    <label
                      key={side}
                      className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border bg-card px-3.5 py-2.5 transition-colors duration-fast ease-out hover:bg-accent has-checked:border-primary has-checked:bg-accent has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring"
                    >
                      <input
                        type="radio"
                        value={side}
                        className="size-4.5 shrink-0 accent-primary focus-visible:outline-none"
                        {...register("represents")}
                      />
                      <span className="text-body font-semibold">
                        {side === "DEFENCE" ? "La defensa" : "La querella"}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </section>

            <section className="grid gap-4">
              <SectionTitle>Números</SectionTitle>
              <div className="grid items-start gap-4 sm:grid-cols-2">
                <TextField
                  form={form}
                  name="mpfLegajo"
                  label="Legajo del MPF"
                  hint="Por ejemplo MPFNQ 12345/2026."
                  maxLength={NUMBER_MAX}
                  numeric
                />
                <TextField
                  form={form}
                  name="internalNumber"
                  label="Número interno del estudio"
                  maxLength={NUMBER_MAX}
                  numeric
                />
                <TextField
                  form={form}
                  name="ofijuNumber"
                  label="Número de la OFIJU"
                  hint="Formato a confirmar [validar]."
                  maxLength={NUMBER_MAX}
                  numeric
                />
                <TextField
                  form={form}
                  name="pehuenNumber"
                  label="Número en Pehuén"
                  hint="Formato a confirmar [validar]."
                  maxLength={NUMBER_MAX}
                  numeric
                />
              </div>
            </section>

            <section className="grid gap-4">
              <SectionTitle>Equipo y reserva</SectionTitle>
              {creating && (
                <Field>
                  <Label htmlFor={fieldIds.responsible}>Responsable de la causa</Label>
                  <Select
                    id={fieldIds.responsible}
                    aria-invalid={errors.responsibleUserId ? true : undefined}
                    aria-describedby={[
                      `${fieldIds.responsible}-hint`,
                      errors.responsibleUserId ? `${fieldIds.responsible}-error` : null,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    {...register("responsibleUserId")}
                  >
                    {meCanBeResponsible ? (
                      <option value="">Vos ({me?.displayName})</option>
                    ) : (
                      <option value="">Elegí a la persona responsable</option>
                    )}
                    {responsibleOptions.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.displayName}
                      </option>
                    ))}
                  </Select>
                  <FieldDescription id={`${fieldIds.responsible}-hint`}>
                    {members.isError
                      ? "No pudimos cargar las personas del estudio: si no elegís, queda a tu cargo."
                      : "Titular o abogado/a del estudio. Después podés sumar a más personas al equipo."}
                  </FieldDescription>
                  <FieldError id={`${fieldIds.responsible}-error`}>
                    {errors.responsibleUserId?.message}
                  </FieldError>
                </Field>
              )}
              <Controller
                control={control}
                name="reserved"
                render={({ field }) => (
                  <div className="grid gap-1.5">
                    <div className="flex min-h-11 items-center gap-3">
                      <Checkbox
                        id={`${formId}-reserved`}
                        checked={field.value}
                        disabled={!canChangeReserved}
                        onCheckedChange={(checked) => field.onChange(checked === true)}
                        aria-describedby={`${formId}-reserved-hint`}
                      />
                      <Label htmlFor={`${formId}-reserved`} className="cursor-pointer">
                        Causa reservada
                      </Label>
                    </div>
                    <FieldDescription id={`${formId}-reserved-hint`}>
                      {canChangeReserved
                        ? "Solo la ven su equipo y la persona titular del estudio."
                        : "Solo la persona titular o quien es responsable de la causa cambian la reserva."}
                    </FieldDescription>
                    <FieldError>{errors.reserved?.message}</FieldError>
                  </div>
                )}
              />
            </section>

            {creating && (
              <section className="grid gap-4">
                <SectionTitle>Imputado</SectionTitle>
                <Controller
                  control={control}
                  name="withDefendant"
                  render={({ field }) => (
                    <div className="flex min-h-11 items-center gap-3">
                      <Checkbox
                        id={`${formId}-withDefendant`}
                        checked={field.value}
                        onCheckedChange={(checked) => field.onChange(checked === true)}
                      />
                      <Label htmlFor={`${formId}-withDefendant`} className="cursor-pointer">
                        Agregá ahora al primer imputado
                      </Label>
                    </div>
                  )}
                />
                {withDefendant ? (
                  <>
                    <PersonFields legend="¿Quién es?" />
                    <Field>
                      <Label htmlFor={fieldIds.stage}>Etapa</Label>
                      <Select
                        id={fieldIds.stage}
                        aria-invalid={errors.stageCode ? true : undefined}
                        aria-describedby={errors.stageCode ? `${fieldIds.stage}-error` : undefined}
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
                      <FieldError id={`${fieldIds.stage}-error`}>
                        {errors.stageCode?.message}
                      </FieldError>
                    </Field>
                  </>
                ) : (
                  <p className="flex items-start gap-2 text-meta text-muted-foreground">
                    <Info aria-hidden="true" className="mt-0.75 size-4.5 shrink-0" />
                    <span>También lo podés agregar después, desde la causa.</span>
                  </p>
                )}
              </section>
            )}
          </form>
        </FormProvider>
      )}
    </FormSheet>
  );
}
