import { useEffect, useId, useMemo, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, CircleAlert, Info, LoaderCircle } from "lucide-react";
import { Controller, useForm, useWatch, type FieldPath } from "react-hook-form";

import { FormSheet } from "@/components/forms/form-sheet";
import { FormSkeleton } from "@/components/forms/form-skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { HearingDraft } from "@/features/ai-assist/ai-assist-api";
import { NotificationDraftPanel } from "@/features/ai-assist/notification-draft-panel";
import { FIRM_TIME_ZONE, instantAt, isIsoDate, isLocalTime } from "@/features/agenda/agenda-dates";
import { cppArticle } from "@/features/agenda/agenda-format";
import { useAgendaCache } from "@/features/agenda/agenda-queries";
import type { NamedRef } from "@/features/agenda/agenda-types";
import { ROLE_LABELS } from "@/features/auth/roles";
import { useMe } from "@/features/auth/me-query";
import { catalogOptionLabel, reviewTags } from "@/features/catalogs/catalog-format";
import { useCatalogOptions, useCatalogsSettled } from "@/features/catalogs/catalog-queries";
import type { AnyCatalogId } from "@/features/catalogs/catalog-types";
import { DEFENDANT_STATUS_LABELS, formatLongDateTime } from "@/features/cases/case-format";
import { caseQueryOptions } from "@/features/cases/case-queries";
import type { CaseDetail } from "@/features/cases/case-types";
import { CasePicker } from "@/features/hearings/case-picker";
import type { HearingDetail } from "@/features/hearings/hearing-api";
import { hearingFormProblem } from "@/features/hearings/hearing-form-errors";
import {
  DURATION_OPTIONS,
  durationLabel,
  hearingFormDefaults,
  hearingFormSchema,
  hearingRequestOf,
  JUDGE_MAX,
  NOT_HELD,
  NOTES_MAX,
  OFIJU_REFERENCE_MAX,
  offeredStatus,
  REQUESTED_BY_LABELS,
  RESCHEDULE_REASON_MAX,
  ROOM_MAX,
  rescheduleBlock,
  type HearingFormInput,
  type HearingFormValues,
} from "@/features/hearings/hearing-form-schema";
import {
  useCreateHearing,
  useHearing,
  useUpdateHearing,
} from "@/features/hearings/hearing-queries";
import { useFirmMembers } from "@/features/members/member-queries";

const FORM_CATALOGS: AnyCatalogId[] = ["hearing-types", "hearing-statuses", "cancellation-reasons"];

interface HearingFormProps {
  /** The case of a new hearing, when it is opened from the case. */
  caseId?: string;
  /** The hearing to edit. */
  hearingId?: string;
  /** The day a new hearing starts on (the agenda's day). */
  defaultDate?: string;
  onClose: () => void;
  /** After saving (and after the clash warning, if any). */
  onSaved?: (hearing: HearingDetail) => void;
}

/** Who can attend: the firm's members, plus anyone already on the hearing or the case team. */
function lawyerChoices(
  members: { id: string; displayName: string; role: keyof typeof ROLE_LABELS }[] | undefined,
  extra: NamedRef[],
): { id: string; name: string; role?: string }[] {
  const choices = new Map<string, { id: string; name: string; role?: string }>();
  for (const member of members ?? []) {
    choices.set(member.id, {
      id: member.id,
      name: member.displayName,
      role: ROLE_LABELS[member.role],
    });
  }
  for (const person of extra) {
    if (!choices.has(person.id)) choices.set(person.id, { id: person.id, name: person.name });
  }
  return [...choices.values()];
}

function ClashWarning({
  hearing,
  names,
  timeZone,
  onDone,
}: {
  hearing: HearingDetail;
  names: Map<string, string>;
  timeZone: string;
  onDone: () => void;
}) {
  return (
    <FormSheet
      title="La audiencia se guardó"
      onClose={onDone}
      footer={<Button onClick={onDone}>Listo</Button>}
    >
      <Alert role="alert">
        <CalendarClock aria-hidden="true" />
        <AlertTitle>Se superpone con otra audiencia</AlertTitle>
        <AlertDescription>
          <ul className="mt-1 grid list-disc gap-1 pl-5">
            {hearing.clashes.map((clash) => (
              <li key={`${clash.hearingId}-${clash.userId}`}>
                {names.get(clash.userId) ?? "Una persona del estudio"} tiene{" "}
                {clash.reserved || !clash.caseCaption
                  ? "otra audiencia de una causa reservada"
                  : `la audiencia de «${clash.caseCaption}»`}{" "}
                el{" "}
                <time dateTime={clash.startsAt} className="tabular-nums">
                  {formatLongDateTime(clash.startsAt, timeZone).replace(/^\p{Lu}/u, (letter) =>
                    letter.toLocaleLowerCase("es-AR"),
                  )}
                </time>
                .
              </li>
            ))}
          </ul>
          <p className="mt-2">
            Quedó guardada igual. Si hay que moverla, editala y cambiá la fecha o quién va.
          </p>
        </AlertDescription>
      </Alert>
    </FormSheet>
  );
}

/**
 * "Nueva audiencia" (from the agenda, choosing the case, or from a case) and "Editá la
 * audiencia". The fields appear once the catalogs and, to edit, the hearing are loaded, so every
 * select starts on its saved value; the sheet itself stays put meanwhile.
 */
export function HearingFormDialog({
  caseId: fixedCaseId,
  hearingId,
  defaultDate,
  onClose,
  onSaved,
}: HearingFormProps) {
  const hearingQuery = useHearing(hearingId);
  const hearing = hearingQuery.data;
  const catalogsReady = useCatalogsSettled(FORM_CATALOGS);
  const ready = catalogsReady && (hearingId === undefined || hearing !== undefined);
  const editing = hearingId !== undefined;
  const formId = useId();
  const { data: me } = useMe();
  const timeZone = useAgendaCache().timeZone ?? FIRM_TIME_ZONE;
  const members = useFirmMembers();
  const types = useCatalogOptions("hearing-types", hearing?.typeCode);
  const statuses = useCatalogOptions("hearing-statuses", hearing?.statusCode);
  const reasons = useCatalogOptions("cancellation-reasons", hearing?.cancellationReasonCode);
  const create = useCreateHearing();
  const update = useUpdateHearing();
  const [general, setGeneral] = useState<string | null>(null);
  const [saved, setSaved] = useState<HearingDetail | null>(null);
  const [caseCaption, setCaseCaption] = useState("");
  const savedValues = useMemo(
    () => (hearing ? hearingFormDefaults({ hearing, timeZone }) : undefined),
    [hearing, timeZone],
  );

  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<HearingFormInput, unknown, HearingFormValues>({
    resolver: zodResolver(hearingFormSchema),
    defaultValues: hearingFormDefaults({ caseId: fixedCaseId, date: defaultDate, timeZone }),
    // To edit: the hearing's values, once it has loaded.
    values: savedValues,
    // A refetch after a failed save must not wipe what the user typed.
    resetOptions: { keepDirtyValues: true },
  });
  const caseId = useWatch({ control, name: "caseId" });
  const typeCode = useWatch({ control, name: "typeCode" });
  const statusCode = useWatch({ control, name: "statusCode" });
  const date = useWatch({ control, name: "date" });
  const time = useWatch({ control, name: "time" });
  const duration = useWatch({ control, name: "durationMinutes" });

  const caseDetail = useQuery({ ...caseQueryOptions(caseId), enabled: caseId !== "" });
  const detail: CaseDetail | undefined = caseDetail.data;
  if (detail && detail.caption !== caseCaption && caseId === detail.id)
    setCaseCaption(detail.caption);

  // A new hearing goes, by default, to the case's responsible (the backend's own default) and
  // calls the case's only open defendant. Set once per chosen case.
  const prefilled = useRef<string | null>(editing ? caseId : null);
  useEffect(() => {
    if (editing || !detail || prefilled.current === detail.id) return;
    prefilled.current = detail.id;
    const responsible = detail.team.find((member) => member.role === "RESPONSIBLE")?.userId;
    const lawyer = responsible ?? me?.id;
    setValue("lawyerIds", lawyer ? [lawyer] : []);
    const open = detail.defendants.filter((defendant) => defendant.status !== "CLOSED");
    setValue("defendantIds", open.length === 1 && open[0] ? [open[0].id] : []);
  }, [detail, editing, me?.id, setValue]);

  const lawyers = lawyerChoices(members.data, [
    ...(hearing?.lawyers ?? []),
    ...(detail?.team.map((member) => ({ id: member.userId, name: member.displayName })) ?? []),
    ...(me ? [{ id: me.id, name: me.displayName }] : []),
  ]);
  const names = new Map(lawyers.map((lawyer) => [lawyer.id, lawyer.name]));
  const defendants: { id: string; name: string; note?: string }[] = detail
    ? detail.defendants.map((defendant) => ({
        id: defendant.id,
        name: defendant.displayName,
        note: defendant.status === "CLOSED" ? DEFENDANT_STATUS_LABELS.CLOSED : undefined,
      }))
    : (hearing?.defendants ?? []);
  const selectedType = types.items.find((item) => item.code === typeCode);
  const typeArticle = selectedType ? cppArticle(selectedType.article) : null;
  const moved =
    hearing !== undefined &&
    isIsoDate(date) &&
    isLocalTime(time) &&
    new Date(instantAt(date, time, timeZone)).getTime() !== new Date(hearing.startsAt).getTime();
  const durationOptions = [...new Set([...DURATION_OPTIONS, duration])]
    .filter((value): value is number => typeof value === "number")
    .sort((a, b) => a - b);

  const submit = handleSubmit(async (values) => {
    setGeneral(null);
    const request = hearingRequestOf(values, timeZone, hearing);
    if (request.reschedule && hearing) {
      const stuck = rescheduleBlock(values.statusCode, hearing);
      if (stuck) {
        setError("date", { message: stuck }, { shouldFocus: true });
        return;
      }
    }
    try {
      const result = hearing
        ? await update.mutateAsync({ id: hearing.id, caseId: hearing.caseId, ...request })
        : await create.mutateAsync({ caseId: values.caseId, data: request.data });
      if (result.clashes.length > 0) {
        setSaved(result);
        return;
      }
      onClose();
      onSaved?.(result);
    } catch (error) {
      const problem = hearingFormProblem(error);
      let first = true;
      for (const [field, message] of Object.entries(problem.fields)) {
        if (!message) continue;
        setError(field as FieldPath<HearingFormValues>, { message }, { shouldFocus: first });
        first = false;
      }
      setGeneral(problem.general ?? null);
    }
  });

  /** Fills what the notification says; the lawyer reviews it and saves the form as usual. */
  const applyDraft = (draft: HearingDraft) => {
    const options = { shouldDirty: true, shouldValidate: true } as const;
    if (draft.typeCode) setValue("typeCode", draft.typeCode, options);
    if (draft.date) setValue("date", draft.date, options);
    if (draft.time) setValue("time", draft.time, options);
    if (draft.durationMinutes) setValue("durationMinutes", draft.durationMinutes, options);
    if (draft.room) setValue("room", draft.room, options);
    if (draft.judge) setValue("judge", draft.judge, options);
    if (draft.ofijuReference) setValue("ofijuReference", draft.ofijuReference, options);
  };

  if (saved) {
    return (
      <ClashWarning
        hearing={saved}
        names={names}
        timeZone={timeZone}
        onDone={() => {
          onClose();
          onSaved?.(saved);
        }}
      />
    );
  }

  const ids = {
    type: `${formId}-type`,
    date: `${formId}-date`,
    time: `${formId}-time`,
    duration: `${formId}-duration`,
    room: `${formId}-room`,
    judge: `${formId}-judge`,
    ofiju: `${formId}-ofiju`,
    requestedBy: `${formId}-requestedBy`,
    status: `${formId}-status`,
    reason: `${formId}-reason`,
    notes: `${formId}-notes`,
    reschedule: `${formId}-reschedule`,
  };
  const describedBy = (...parts: (string | false | null | undefined)[]) =>
    parts.filter(Boolean).join(" ") || undefined;
  const textField = (
    name: "room" | "judge" | "ofijuReference",
    id: string,
    label: string,
    maxLength: number,
  ) => (
    <Field>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        maxLength={maxLength}
        autoComplete="off"
        aria-invalid={errors[name] ? true : undefined}
        aria-describedby={errors[name] ? `${id}-error` : undefined}
        {...register(name)}
      />
      <FieldError id={`${id}-error`}>{errors[name]?.message}</FieldError>
    </Field>
  );

  return (
    <FormSheet
      title={editing ? "Editá la audiencia" : "Nueva audiencia"}
      description={
        editing
          ? (hearing?.caseCaption ?? "")
          : "Cargala como la fijó la Oficina Judicial. Si se superpone con otra, te avisamos al guardar."
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
            {editing ? "Guardá los cambios" : "Guardá la audiencia"}
          </Button>
        </>
      }
    >
      {hearingQuery.isError ? (
        <Alert variant="error" role="alert">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>No pudimos cargar la audiencia</AlertTitle>
          <AlertDescription>
            Revisá tu conexión y volvé a intentar.{" "}
            <Button
              variant="link"
              className="h-auto min-h-0 p-0"
              onClick={() => void hearingQuery.refetch()}
            >
              Volvé a intentar
            </Button>
          </AlertDescription>
        </Alert>
      ) : !ready ? (
        <FormSkeleton />
      ) : (
        <form id={formId} noValidate onSubmit={submit} className="grid gap-6">
          {general && (
            <Alert variant="error" role="alert">
              <CircleAlert aria-hidden="true" />
              <AlertDescription>{general}</AlertDescription>
            </Alert>
          )}

          {!editing && !fixedCaseId && (
            <CasePicker
              value={caseId}
              caption={caseCaption}
              error={errors.caseId?.message}
              onChange={(selected) => {
                setValue("caseId", selected?.id ?? "", { shouldValidate: selected !== null });
                setCaseCaption(selected?.caption ?? "");
              }}
            />
          )}

          {!editing && caseId !== "" && (
            <NotificationDraftPanel key={caseId} caseId={caseId} onDraft={applyDraft} />
          )}

          <Field>
            <Label htmlFor={ids.type}>Tipo de audiencia</Label>
            <Select
              id={ids.type}
              aria-invalid={errors.typeCode ? true : undefined}
              aria-describedby={describedBy(
                typeArticle && `${ids.type}-article`,
                errors.typeCode && `${ids.type}-error`,
              )}
              {...register("typeCode")}
            >
              <option value="">Elegí el tipo</option>
              {types.items.map((item) => (
                <option key={item.code} value={item.code}>
                  {catalogOptionLabel(item)}
                </option>
              ))}
            </Select>
            {selectedType && (typeArticle || selectedType.flags.length > 0) && (
              <FieldDescription id={`${ids.type}-article`} className="tabular-nums">
                {[typeArticle, reviewTags(selectedType.flags)].filter(Boolean).join(" ")}
              </FieldDescription>
            )}
            <FieldError id={`${ids.type}-error`}>{errors.typeCode?.message}</FieldError>
          </Field>

          <div className="grid items-start gap-4 sm:grid-cols-3">
            <Field>
              <Label htmlFor={ids.date}>Día</Label>
              <Input
                id={ids.date}
                type="date"
                className="tabular-nums"
                aria-invalid={errors.date ? true : undefined}
                aria-describedby={errors.date ? `${ids.date}-error` : undefined}
                {...register("date")}
              />
              <FieldError id={`${ids.date}-error`}>{errors.date?.message}</FieldError>
            </Field>
            <Field>
              <Label htmlFor={ids.time}>Hora</Label>
              <Input
                id={ids.time}
                type="time"
                step={300}
                className="tabular-nums"
                aria-invalid={errors.time ? true : undefined}
                aria-describedby={errors.time ? `${ids.time}-error` : undefined}
                {...register("time")}
              />
              <FieldError id={`${ids.time}-error`}>{errors.time?.message}</FieldError>
            </Field>
            <Field>
              <Label htmlFor={ids.duration}>Duración</Label>
              <Controller
                control={control}
                name="durationMinutes"
                render={({ field }) => (
                  <Select
                    id={ids.duration}
                    name={field.name}
                    ref={field.ref}
                    value={String(field.value)}
                    onBlur={field.onBlur}
                    onChange={(event) => field.onChange(Number(event.target.value))}
                    aria-invalid={errors.durationMinutes ? true : undefined}
                    aria-describedby={errors.durationMinutes ? `${ids.duration}-error` : undefined}
                  >
                    {durationOptions.map((minutes) => (
                      <option key={minutes} value={minutes}>
                        {durationLabel(minutes)}
                      </option>
                    ))}
                  </Select>
                )}
              />
              <FieldError id={`${ids.duration}-error`}>
                {errors.durationMinutes?.message}
              </FieldError>
            </Field>
          </div>
          <p className="-mt-3 text-small text-muted-foreground">Hora de Neuquén.</p>

          {moved && (
            <div className="grid gap-3">
              <Alert>
                <Info aria-hidden="true" />
                <AlertDescription>
                  Al cambiar el día o la hora, la audiencia queda «Reprogramada» y la fecha anterior
                  se guarda en su historial.
                </AlertDescription>
              </Alert>
              <Field>
                <Label htmlFor={ids.reschedule}>Motivo de la reprogramación</Label>
                <Input
                  id={ids.reschedule}
                  maxLength={RESCHEDULE_REASON_MAX}
                  autoComplete="off"
                  aria-describedby={describedBy(
                    `${ids.reschedule}-hint`,
                    errors.rescheduleReason && `${ids.reschedule}-error`,
                  )}
                  aria-invalid={errors.rescheduleReason ? true : undefined}
                  {...register("rescheduleReason")}
                />
                <FieldDescription id={`${ids.reschedule}-hint`}>Opcional.</FieldDescription>
                <FieldError id={`${ids.reschedule}-error`}>
                  {errors.rescheduleReason?.message}
                </FieldError>
              </Field>
            </div>
          )}

          <div className="grid items-start gap-4 sm:grid-cols-2">
            {textField("room", ids.room, "Sala", ROOM_MAX)}
            {textField("judge", ids.judge, "Juez o jueza", JUDGE_MAX)}
            {textField("ofijuReference", ids.ofiju, "Referencia de la OFIJU", OFIJU_REFERENCE_MAX)}
            <Field>
              <Label htmlFor={ids.requestedBy}>Quién la pidió</Label>
              <Select id={ids.requestedBy} {...register("requestedBy")}>
                <option value="">Sin cargar</option>
                {Object.entries(REQUESTED_BY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid items-start gap-4 sm:grid-cols-2">
            <Field>
              <Label htmlFor={ids.status}>Estado</Label>
              <Select
                id={ids.status}
                aria-invalid={errors.statusCode ? true : undefined}
                aria-describedby={errors.statusCode ? `${ids.status}-error` : undefined}
                {...register("statusCode")}
              >
                {statuses.items
                  .filter((item) => offeredStatus(item.code, hearing?.statusCode))
                  .map((item) => (
                    <option key={item.code} value={item.code}>
                      {catalogOptionLabel(item, { article: false })}
                    </option>
                  ))}
              </Select>
              <FieldError id={`${ids.status}-error`}>{errors.statusCode?.message}</FieldError>
            </Field>
            {NOT_HELD.includes(statusCode) && (
              <Field>
                <Label htmlFor={ids.reason}>Motivo</Label>
                <Select
                  id={ids.reason}
                  aria-invalid={errors.cancellationReasonCode ? true : undefined}
                  aria-describedby={
                    errors.cancellationReasonCode ? `${ids.reason}-error` : undefined
                  }
                  {...register("cancellationReasonCode")}
                >
                  <option value="">Sin cargar</option>
                  {reasons.items.map((item) => (
                    <option key={item.code} value={item.code}>
                      {catalogOptionLabel(item, { article: false })}
                    </option>
                  ))}
                </Select>
                <FieldError id={`${ids.reason}-error`}>
                  {errors.cancellationReasonCode?.message}
                </FieldError>
              </Field>
            )}
          </div>

          <Controller
            control={control}
            name="lawyerIds"
            render={({ field }) => (
              <fieldset
                className="grid gap-2"
                aria-describedby={errors.lawyerIds ? `${formId}-lawyers-error` : undefined}
              >
                <legend className="mb-1.5 text-body font-semibold">Quién va del estudio</legend>
                {lawyers.length === 0 ? (
                  <p className="text-meta text-muted-foreground">
                    {members.isPending
                      ? "Cargando las personas del estudio…"
                      : "Elegí la causa primero."}
                  </p>
                ) : (
                  <ul className="grid gap-1 sm:grid-cols-2">
                    {lawyers.map((lawyer) => {
                      const checkboxId = `${formId}-lawyer-${lawyer.id}`;
                      return (
                        <li key={lawyer.id} className="flex min-h-11 items-center gap-3">
                          <Checkbox
                            id={checkboxId}
                            checked={field.value.includes(lawyer.id)}
                            aria-invalid={errors.lawyerIds ? true : undefined}
                            onCheckedChange={(checked) =>
                              field.onChange(
                                checked === true
                                  ? [...field.value, lawyer.id]
                                  : field.value.filter((value) => value !== lawyer.id),
                              )
                            }
                          />
                          <Label htmlFor={checkboxId} className="cursor-pointer">
                            {lawyer.name}
                            {lawyer.role && (
                              <span className="font-normal text-muted-foreground">
                                {" "}
                                · {lawyer.role}
                              </span>
                            )}
                          </Label>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {members.isError && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <p className="text-meta text-muted-foreground">
                      No pudimos cargar a todas las personas del estudio.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={members.isFetching}
                      onClick={() => void members.refetch()}
                    >
                      Reintentá
                    </Button>
                  </div>
                )}
                <FieldError id={`${formId}-lawyers-error`}>{errors.lawyerIds?.message}</FieldError>
              </fieldset>
            )}
          />

          <Controller
            control={control}
            name="defendantIds"
            render={({ field }) => (
              <fieldset
                className="grid gap-2"
                aria-describedby={errors.defendantIds ? `${formId}-defendants-error` : undefined}
              >
                <legend className="mb-1.5 text-body font-semibold">Imputados citados</legend>
                {defendants.length === 0 ? (
                  <p className="text-meta text-muted-foreground">
                    {caseId === ""
                      ? "Elegí la causa para ver sus imputados."
                      : caseDetail.isPending
                        ? "Cargando los imputados de la causa…"
                        : "La causa todavía no tiene imputados cargados."}
                  </p>
                ) : (
                  <ul className="grid gap-1 sm:grid-cols-2">
                    {defendants.map((defendant) => {
                      const checkboxId = `${formId}-defendant-${defendant.id}`;
                      return (
                        <li key={defendant.id} className="flex min-h-11 items-center gap-3">
                          <Checkbox
                            id={checkboxId}
                            checked={field.value.includes(defendant.id)}
                            onCheckedChange={(checked) =>
                              field.onChange(
                                checked === true
                                  ? [...field.value, defendant.id]
                                  : field.value.filter((value) => value !== defendant.id),
                              )
                            }
                          />
                          <Label htmlFor={checkboxId} className="cursor-pointer">
                            {defendant.name}
                            {defendant.note && (
                              <span className="font-normal text-muted-foreground">
                                {" "}
                                · {defendant.note}
                              </span>
                            )}
                          </Label>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <FieldError id={`${formId}-defendants-error`}>
                  {errors.defendantIds?.message}
                </FieldError>
              </fieldset>
            )}
          />

          <Field>
            <Label htmlFor={ids.notes}>Notas</Label>
            <Textarea
              id={ids.notes}
              maxLength={NOTES_MAX}
              aria-describedby={describedBy(
                `${ids.notes}-hint`,
                errors.notes && `${ids.notes}-error`,
              )}
              aria-invalid={errors.notes ? true : undefined}
              {...register("notes")}
            />
            <FieldDescription id={`${ids.notes}-hint`}>
              Opcional. Lo ve todo el equipo de la causa.
            </FieldDescription>
            <FieldError id={`${ids.notes}-error`}>{errors.notes?.message}</FieldError>
          </Field>
        </form>
      )}
    </FormSheet>
  );
}
