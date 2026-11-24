import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useMemo, useState } from "react";
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
import { CASE_STATUS_LABELS } from "@/features/cases/case-format";
import {
  CAPTION_MAX,
  caseDataOf,
  caseFormDefaults,
  caseFormSchema,
  CLOSED_STAGE,
  defendantDataOf,
  defendantFormDefaults,
  NUMBER_MAX,
  type CaseFormArea,
  type CaseFormValues,
} from "@/features/cases/case-form-schema";
import {
  caseFormProblem,
  defendantProblem,
  partyProblem,
  personProblem,
} from "@/features/cases/case-form-errors";
import {
  useAddDefendant,
  useAddParty,
  useCreateCase,
  useCreatePerson,
  useUpdateCase,
} from "@/features/cases/case-mutations";
import type { CaseDetail, CaseStatus } from "@/features/cases/case-types";
import { canBeResponsible, useFirmMembers } from "@/features/members/member-queries";
import { PersonFields } from "@/features/persons/person-fields";
import { newPersonOf } from "@/features/persons/person-schema";
import { AreaChoice, AreaDraftNote } from "@/features/practice-areas/area-choice";
import { hasModule, initialArea } from "@/features/practice-areas/practice-area-format";
import { useAreaDirectory } from "@/features/practice-areas/practice-area-queries";
import type { PracticeModule } from "@/features/practice-areas/practice-area-types";
import { useStickyReady } from "@/lib/use-sticky-ready";

/** Wait for them so the selects show the saved value from the first render. */
const FORM_CATALOGS: AnyCatalogId[] = [
  "circumscriptions",
  "stages",
  "action-types",
  "represented-sides",
];

/** What the criminal area turns on: assumed while the firm's areas load or if they fail. */
const CRIMINAL_MODULES: PracticeModule[] = ["defendants", "mpf-legajo"];

const CASE_STATUSES = Object.keys(CASE_STATUS_LABELS) as CaseStatus[];

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
  /** The area a new case starts in (the list's filter), when the firm works in it. */
  area?: string;
  onClose: () => void;
}

/** First option of a catalog, to fill a select whose value the area does not offer. */
function useFirstOption(
  form: ReturnType<typeof useForm<CaseFormValues>>,
  name: "actionType" | "represents" | "caseStageCode",
  codes: string[],
) {
  const value = useWatch({ control: form.control, name });
  const first = codes[0];
  const offered = codes.includes(value);
  useEffect(() => {
    if (!offered && first !== undefined) form.setValue(name, first);
  }, [offered, first, form, name]);
}

/**
 * "Nueva causa" (`detail` undefined) or "Editá la causa". A new case starts by its practice area
 * (only asked when the firm works in more than one) and can bring its first defendant (criminal)
 * or its first party (other areas): the new person (if any) is created first, then the case,
 * then the defendant or the party; after saving, the new case opens. In an area without
 * defendants the case carries its own stage and status. The team and the custom fields are not
 * changed here.
 */
export function CaseFormDialog({
  detail,
  canChangeReserved = true,
  area: preferredArea,
  onClose,
}: CaseFormProps) {
  const creating = detail === undefined;
  const formId = useId();
  const navigate = useNavigate();
  const { data: me } = useMe();
  const meCanBeResponsible = me ? canBeResponsible(me) : false;
  const members = useFirmMembers();
  const directory = useAreaDirectory();

  const createCase = useCreateCase();
  const queryClient = useQueryClient();
  const updateCase = useUpdateCase(detail?.id ?? "");
  const createPerson = useCreatePerson();
  const addDefendant = useAddDefendant();
  const addParty = useAddParty();
  const [general, setGeneral] = useState<string | null>(null);
  /** The case was saved but its first defendant or party was not. */
  const [partial, setPartial] = useState<{
    caseId: string;
    message: string;
    defendant: boolean;
  } | null>(null);

  const [areaFlags, setAreaFlags] = useState<CaseFormArea>({ defendants: true, mpfLegajo: true });
  const schema = useMemo(
    () => caseFormSchema({ requireResponsible: !meCanBeResponsible, creating, area: areaFlags }),
    [meCanBeResponsible, creating, areaFlags],
  );
  const form = useForm<CaseFormValues>({
    resolver: zodResolver(schema),
    defaultValues: caseFormDefaults(detail, initialArea(directory.areas)),
  });
  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    getFieldState,
    formState: { errors, isSubmitting },
  } = form;

  // A new case starts in the firm's default area once the list of areas is known.
  const areasLoaded = !directory.isPending;
  const startingArea = directory.find(preferredArea)?.code ?? initialArea(directory.areas);
  useEffect(() => {
    if (creating && areasLoaded && !getFieldState("practiceArea").isDirty) {
      setValue("practiceArea", startingArea);
    }
  }, [creating, areasLoaded, startingArea, getFieldState, setValue]);

  const areaCode = useWatch({ control, name: "practiceArea" });
  const area = directory.find(areaCode);
  const modules =
    detail?.modules ?? area?.modules ?? (directory.areas.length === 0 ? CRIMINAL_MODULES : []);
  const flags: CaseFormArea = {
    defendants: hasModule(modules, "defendants"),
    mpfLegajo: hasModule(modules, "mpf-legajo"),
  };
  if (flags.defendants !== areaFlags.defendants || flags.mpfLegajo !== areaFlags.mpfLegajo) {
    setAreaFlags(flags);
  }

  const circumscriptions = useCatalogOptions(
    "circumscriptions",
    detail?.circumscriptionCode,
    areaCode,
  );
  const actionTypes = useCatalogOptions("action-types", detail?.actionType, areaCode);
  const sides = useCatalogOptions("represented-sides", detail?.represents, areaCode);
  const stages = useCatalogOptions("stages", detail?.stageCode, areaCode);
  const outcomes = useCatalogOptions("closing-outcomes", detail?.closingOutcomeCode, areaCode);
  const roles = useCatalogOptions("party-roles", undefined, areaCode);
  const openStages = stages.items.filter((item) => item.code !== CLOSED_STAGE);
  const catalogsSettled = useCatalogsSettled(FORM_CATALOGS, areaCode);
  const ready = useStickyReady(catalogsSettled && (!creating || areasLoaded));

  useFirstOption(
    form,
    "actionType",
    actionTypes.items.map((item) => item.code),
  );
  useFirstOption(
    form,
    "represents",
    sides.items.map((item) => item.code),
  );
  useFirstOption(
    form,
    "caseStageCode",
    flags.defendants ? [] : openStages.map((item) => item.code),
  );

  const withDefendant = useWatch({ control, name: "withDefendant" });
  const withParty = useWatch({ control, name: "withParty" });
  const represents = useWatch({ control, name: "represents" });
  const caseStatus = useWatch({ control, name: "caseStatus" });
  // The first party is, by default, the one the firm represents (the actor, the demandado...).
  const representedRole = roles.items.find((item) => item.code === represents)?.code;
  const firstRole = roles.items[0]?.code;
  useEffect(() => {
    const role = representedRole ?? firstRole;
    if (role && !getFieldState("partyRoleCode").isDirty) setValue("partyRoleCode", role);
  }, [representedRole, firstRole, getFieldState, setValue]);

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

  const showAreaChoice = creating && directory.areas.length > 1;

  const submit = handleSubmit(async (values) => {
    setGeneral(null);
    if (!creating) {
      try {
        await updateCase.mutateAsync(caseDataOf(values, false, flags));
        onClose();
      } catch (error) {
        const problem = caseFormProblem(error);
        markFields(problem.fields);
        setGeneral(problem.general ?? null);
      }
      return;
    }

    const withPerson = flags.defendants ? values.withDefendant : values.withParty;
    let personId = values.person.personId;
    let personName = values.person.personName;
    if (withPerson && values.person.mode === "new") {
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
      created = await createCase.mutateAsync(caseDataOf(values, true, flags));
    } catch (error) {
      const problem = caseFormProblem(error);
      const { practiceArea: areaProblem, ...fields } = problem.fields;
      if (areaProblem) {
        // The firm's areas changed meanwhile (e.g. in Ajustes): reload them for the choice.
        void queryClient.invalidateQueries({ queryKey: ["practice-areas"] });
      }
      markFields(showAreaChoice ? problem.fields : fields);
      setGeneral(problem.general ?? (showAreaChoice ? undefined : areaProblem) ?? null);
      return;
    }

    if (withPerson && flags.defendants) {
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
          defendant: true,
          message: `La causa quedó guardada, pero no pudimos sumar a ${personName} como imputado. ${reason}`,
        });
        return;
      }
    } else if (withPerson) {
      try {
        await addParty.mutateAsync({
          caseId: created.id,
          data: { personId, roleCode: values.partyRoleCode },
        });
      } catch (error) {
        const problem = partyProblem(error);
        const reason = problem.general ?? Object.values(problem.fields)[0] ?? "";
        setPartial({
          caseId: created.id,
          defendant: false,
          message: `La causa quedó guardada, pero no pudimos sumar a ${personName} como parte. ${reason}`,
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
          <AlertTitle>{partial.defendant ? "Falta el imputado" : "Falta la parte"}</AlertTitle>
          <AlertDescription>
            {partial.message}{" "}
            {partial.defendant
              ? "Abrí la causa y agregalo desde «Imputados»."
              : "Abrí la causa y agregala desde «Partes»."}
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
    caseStage: `${formId}-caseStage`,
    caseStatus: `${formId}-caseStatus`,
    caseOutcome: `${formId}-caseOutcome`,
    partyRole: `${formId}-partyRole`,
  };
  const caseClosed = caseStatus === "CLOSED";

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

            {showAreaChoice && (
              <section className="grid gap-3">
                <AreaChoice
                  areas={directory.areas}
                  field={register("practiceArea")}
                  legend="¿De qué fuero es la causa?"
                />
                <FieldError>{errors.practiceArea?.message}</FieldError>
                {area && !flags.defendants && <AreaDraftNote area={area} />}
              </section>
            )}

            <section className="grid gap-4">
              <SectionTitle>Datos de la causa</SectionTitle>
              <TextField
                form={form}
                name="caption"
                label="Carátula"
                hint={
                  flags.defendants
                    ? "Como figura en el legajo, por ejemplo «Modelo, Carla s/ robo» (datos ficticios)."
                    : "Como figura en el expediente, por ejemplo «Ficticio, Juan c/ Ejemplo S.A. s/ cobro» (datos ficticios)."
                }
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
                  <Label htmlFor={fieldIds.actionType}>
                    {flags.defendants ? "Tipo de acción" : "Tipo de proceso"}
                  </Label>
                  <Select
                    id={fieldIds.actionType}
                    disabled={actionTypes.isPending}
                    aria-invalid={errors.actionType ? true : undefined}
                    aria-describedby={
                      errors.actionType ? `${fieldIds.actionType}-error` : undefined
                    }
                    {...register("actionType")}
                  >
                    {actionTypes.isPending && <option value="">Cargando…</option>}
                    {actionTypes.items.map((item) => (
                      <option key={item.code} value={item.code}>
                        {catalogOptionLabel(item)}
                      </option>
                    ))}
                  </Select>
                  <FieldError id={`${fieldIds.actionType}-error`}>
                    {errors.actionType?.message}
                  </FieldError>
                </Field>
              </div>
              <fieldset className="grid gap-2">
                <legend className="mb-1.5 text-body font-semibold">El estudio representa a</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {sides.items.map((side) => (
                    <label
                      key={side.code}
                      className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border bg-card px-3.5 py-2.5 transition-colors duration-fast ease-out hover:bg-accent has-checked:border-primary has-checked:bg-accent has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring"
                    >
                      <input
                        type="radio"
                        value={side.code}
                        className="size-4.5 shrink-0 accent-primary focus-visible:outline-none"
                        {...register("represents")}
                      />
                      <span className="text-body font-semibold">
                        {catalogOptionLabel(side, { article: false })}
                      </span>
                    </label>
                  ))}
                </div>
                <FieldError>{errors.represents?.message}</FieldError>
              </fieldset>
            </section>

            {!flags.defendants && (
              <section className="grid gap-4">
                <SectionTitle>{creating ? "Etapa" : "Etapa y estado"}</SectionTitle>
                <div className="grid items-start gap-4 sm:grid-cols-2">
                  {!creating && (
                    <Field>
                      <Label htmlFor={fieldIds.caseStatus}>Estado de la causa</Label>
                      <Select id={fieldIds.caseStatus} {...register("caseStatus")}>
                        {CASE_STATUSES.map((value) => (
                          <option key={value} value={value}>
                            {CASE_STATUS_LABELS[value]}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  )}
                  {caseClosed ? (
                    <Field>
                      <Label htmlFor={fieldIds.caseOutcome}>Cómo terminó</Label>
                      <Select
                        id={fieldIds.caseOutcome}
                        aria-invalid={errors.caseOutcomeCode ? true : undefined}
                        aria-describedby={
                          errors.caseOutcomeCode ? `${fieldIds.caseOutcome}-error` : undefined
                        }
                        {...register("caseOutcomeCode")}
                      >
                        <option value="">Elegí el resultado</option>
                        {outcomes.items.map((item) => (
                          <option key={item.code} value={item.code}>
                            {catalogOptionLabel(item)}
                          </option>
                        ))}
                      </Select>
                      <FieldError id={`${fieldIds.caseOutcome}-error`}>
                        {errors.caseOutcomeCode?.message}
                      </FieldError>
                    </Field>
                  ) : (
                    <Field>
                      <Label htmlFor={fieldIds.caseStage}>Etapa</Label>
                      <Select
                        id={fieldIds.caseStage}
                        disabled={stages.isPending}
                        aria-invalid={errors.caseStageCode ? true : undefined}
                        aria-describedby={
                          [
                            creating ? `${fieldIds.caseStage}-hint` : null,
                            errors.caseStageCode ? `${fieldIds.caseStage}-error` : null,
                          ]
                            .filter(Boolean)
                            .join(" ") || undefined
                        }
                        {...register("caseStageCode")}
                      >
                        {stages.isPending && <option value="">Cargando…</option>}
                        {openStages.map((item) => (
                          <option key={item.code} value={item.code}>
                            {catalogOptionLabel(item)}
                          </option>
                        ))}
                      </Select>
                      {creating && (
                        <FieldDescription id={`${fieldIds.caseStage}-hint`}>
                          Si recién empieza, dejala en la primera.
                        </FieldDescription>
                      )}
                      <FieldError id={`${fieldIds.caseStage}-error`}>
                        {errors.caseStageCode?.message}
                      </FieldError>
                    </Field>
                  )}
                </div>
                {caseClosed && (
                  <p className="-mt-2 text-small text-muted-foreground">
                    Una causa cerrada pasa a la etapa «Cerrada».
                  </p>
                )}
              </section>
            )}

            <section className="grid gap-4">
              <SectionTitle>Números</SectionTitle>
              <div className="grid items-start gap-4 sm:grid-cols-2">
                {flags.mpfLegajo && (
                  <TextField
                    form={form}
                    name="mpfLegajo"
                    label="Legajo del MPF"
                    hint="Por ejemplo MPFNQ 12345/2026."
                    maxLength={NUMBER_MAX}
                    numeric
                  />
                )}
                <TextField
                  form={form}
                  name="internalNumber"
                  label="Número interno del estudio"
                  maxLength={NUMBER_MAX}
                  numeric
                />
                {flags.mpfLegajo && (
                  <>
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
                  </>
                )}
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

            {creating && flags.defendants && (
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
                        {openStages.map((item) => (
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

            {creating && !flags.defendants && (
              <section className="grid gap-4">
                <SectionTitle>Partes</SectionTitle>
                <Controller
                  control={control}
                  name="withParty"
                  render={({ field }) => (
                    <div className="flex min-h-11 items-center gap-3">
                      <Checkbox
                        id={`${formId}-withParty`}
                        checked={field.value}
                        onCheckedChange={(checked) => field.onChange(checked === true)}
                      />
                      <Label htmlFor={`${formId}-withParty`} className="cursor-pointer">
                        Agregá ahora a la primera parte
                      </Label>
                    </div>
                  )}
                />
                {withParty ? (
                  <>
                    <PersonFields legend="¿Quién es?" />
                    <Field>
                      <Label htmlFor={fieldIds.partyRole}>Rol en la causa</Label>
                      <Select
                        id={fieldIds.partyRole}
                        aria-invalid={errors.partyRoleCode ? true : undefined}
                        aria-describedby={
                          errors.partyRoleCode ? `${fieldIds.partyRole}-error` : undefined
                        }
                        {...register("partyRoleCode")}
                      >
                        {roles.items.map((item) => (
                          <option key={item.code} value={item.code}>
                            {catalogOptionLabel(item)}
                          </option>
                        ))}
                      </Select>
                      <FieldError id={`${fieldIds.partyRole}-error`}>
                        {errors.partyRoleCode?.message}
                      </FieldError>
                    </Field>
                  </>
                ) : (
                  <p className="flex items-start gap-2 text-meta text-muted-foreground">
                    <Info aria-hidden="true" className="mt-0.75 size-4.5 shrink-0" />
                    <span>
                      Por ejemplo, a quien representa el estudio. Las demás partes las agregás
                      después, desde la causa.
                    </span>
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
