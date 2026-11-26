import { useId, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "@tanstack/react-router";
import { CircleAlert, Info, LoaderCircle } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";

import { FormSheet } from "@/components/forms/form-sheet";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ConflictMatches } from "@/features/persons/conflict-matches";
import type { PersonRecord, PersonView } from "@/features/persons/person-api";
import {
  ADDRESS_MAX,
  ALIASES_MAX,
  documentOf,
  duplicatePersonId,
  EMAIL_MAX,
  LEGAL_NAME_MAX,
  NATIONALITY_MAX,
  PHONE_MAX,
  personDataOf,
  personFormSchema,
  personFormValues,
  personProblem,
  type PersonFormField,
  type PersonFormValues,
} from "@/features/persons/person-form-schema";
import { PERSON_KIND_LABELS } from "@/features/persons/person-format";
import { useConflictCheck, useSavePerson } from "@/features/persons/person-queries";
import {
  documentShapeError,
  DOCUMENT_MAX,
  DOCUMENT_TYPE_LABELS,
  NAME_MAX,
} from "@/features/persons/person-schema";

const choiceCard =
  "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border bg-card px-3.5 py-2.5 transition-colors duration-fast ease-out hover:bg-accent has-checked:border-primary has-checked:bg-accent has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring";

/**
 * "Nueva persona" (human or legal entity) or, with `person`, its edit (the kind stays). On a new
 * person the document number is checked against the firm as soon as the field is left: who else
 * has it and in which cases (the conflict-of-interest alert). The number goes in a POST body, never
 * in a URL.
 */
export function PersonFormDialog({
  person,
  onClose,
  onCreated,
}: {
  person?: PersonRecord;
  onClose: () => void;
  /** After a create, e.g. to open the new person's detail. */
  onCreated?: (person: PersonView) => void;
}) {
  const formId = useId();
  const save = useSavePerson(person?.id);
  const conflict = useConflictCheck();
  const [checkedNumber, setCheckedNumber] = useState<string | null>(null);
  const [general, setGeneral] = useState<string | null>(null);
  const [duplicateId, setDuplicateId] = useState<string | null>(null);

  const form = useForm<PersonFormValues>({
    resolver: zodResolver(personFormSchema),
    defaultValues: personFormValues(person),
  });
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = form;
  const kind = useWatch({ control, name: "kind" });
  const documentType = useWatch({ control, name: "documentType" });
  const documentNumber = useWatch({ control, name: "documentNumber" });
  const current = documentOf({ documentType, documentNumber });
  const human = kind === "HUMAN";

  /** On a new person, look the number up once it has the shape of its type. */
  const checkDocument = () => {
    if (person) return;
    const document = documentOf(form.getValues());
    if (!document || documentShapeError(document.type, document.number)) return;
    if (document.number === checkedNumber) return;
    setCheckedNumber(document.number);
    conflict.mutate(document.number);
  };

  const submit = handleSubmit(async (values) => {
    setGeneral(null);
    setDuplicateId(null);
    try {
      const saved = await save.mutateAsync(personDataOf(values));
      if (person) onClose();
      else onCreated?.(saved);
    } catch (error) {
      const problem = personProblem(error);
      let first = true;
      for (const [field, message] of Object.entries(problem.fields)) {
        if (!message) continue;
        setError(field as PersonFormField, { message }, { shouldFocus: first });
        first = false;
      }
      setGeneral(problem.general ?? null);
      setDuplicateId(duplicatePersonId(error));
    }
  });

  const id = (name: PersonFormField) => `${formId}-${name}`;
  /** aria-describedby: the hint (if any) and the error (when there is one). */
  const described = (name: PersonFormField, hint = false) =>
    [hint ? `${id(name)}-hint` : null, errors[name] ? `${id(name)}-error` : null]
      .filter(Boolean)
      .join(" ") || undefined;
  const invalid = (name: PersonFormField) => (errors[name] ? true : undefined);
  const showConflict =
    !person && conflict.isSuccess && current !== null && current.number === checkedNumber;

  return (
    <FormSheet
      title={person ? `Editá a ${person.displayName}` : "Nueva persona"}
      description={
        person
          ? PERSON_KIND_LABELS[person.kind]
          : "Un defendido, una víctima, un testigo o una empresa: quien figure en tus causas."
      }
      onClose={onClose}
      className="sm:max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelá
          </Button>
          <Button type="submit" form={formId} disabled={isSubmitting}>
            {isSubmitting && (
              <LoaderCircle
                aria-hidden="true"
                className="animate-spin motion-reduce:animate-none"
              />
            )}
            Guardá la persona
          </Button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={submit} className="grid gap-5">
        {general && (
          <Alert variant="error" role="alert">
            <CircleAlert aria-hidden="true" />
            <AlertDescription>{general}</AlertDescription>
          </Alert>
        )}
        {duplicateId && (
          <Alert variant="error" role="alert">
            <CircleAlert aria-hidden="true" />
            <AlertTitle>Ya existe una persona con ese documento</AlertTitle>
            <AlertDescription>
              <p>No se cargó de nuevo: usá la ficha que ya tiene el estudio.</p>
              <Link
                to="/personas/$personId"
                params={{ personId: duplicateId }}
                className="inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-4"
              >
                Abrí la ficha de esa persona
              </Link>
            </AlertDescription>
          </Alert>
        )}

        <p className="flex items-start gap-2 text-small text-muted-foreground">
          <Info aria-hidden="true" className="mt-0.5 size-4.5 shrink-0" />
          <span>
            Cargá solo lo que la defensa necesita. No anotes datos sensibles como salud, religión u
            opiniones políticas (Ley 25.326).
          </span>
        </p>

        {!person && (
          <fieldset className="grid gap-2">
            <legend className="mb-1.5 text-body font-semibold">¿Qué tipo de persona es?</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {(["HUMAN", "LEGAL"] as const).map((value) => (
                <label key={value} className={choiceCard}>
                  <input
                    type="radio"
                    value={value}
                    className="size-4.5 shrink-0 accent-primary focus-visible:outline-none"
                    {...register("kind")}
                  />
                  <span className="grid">
                    <span className="text-body font-semibold">{PERSON_KIND_LABELS[value]}</span>
                    <span className="text-small text-muted-foreground">
                      {value === "HUMAN" ? "Con nombre y apellido" : "Empresa, asociación, ente"}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {human ? (
          <div className="grid items-start gap-5 sm:grid-cols-2">
            <Field>
              <Label htmlFor={id("lastNames")}>Apellidos</Label>
              <Input
                id={id("lastNames")}
                maxLength={NAME_MAX}
                autoComplete="off"
                aria-invalid={invalid("lastNames")}
                aria-describedby={described("lastNames")}
                {...register("lastNames")}
              />
              <FieldError id={`${id("lastNames")}-error`}>{errors.lastNames?.message}</FieldError>
            </Field>
            <Field>
              <Label htmlFor={id("firstNames")}>Nombres</Label>
              <Input
                id={id("firstNames")}
                maxLength={NAME_MAX}
                autoComplete="off"
                aria-invalid={invalid("firstNames")}
                aria-describedby={described("firstNames")}
                {...register("firstNames")}
              />
              <FieldError id={`${id("firstNames")}-error`}>{errors.firstNames?.message}</FieldError>
            </Field>
          </div>
        ) : (
          <Field>
            <Label htmlFor={id("legalName")}>Razón social</Label>
            <Input
              id={id("legalName")}
              maxLength={LEGAL_NAME_MAX}
              autoComplete="off"
              aria-invalid={invalid("legalName")}
              aria-describedby={described("legalName")}
              {...register("legalName")}
            />
            <FieldError id={`${id("legalName")}-error`}>{errors.legalName?.message}</FieldError>
          </Field>
        )}

        <Field>
          <Label htmlFor={id("aliases")}>
            {human ? "Apodos u otros nombres" : "Nombre de fantasía"}
          </Label>
          <Input
            id={id("aliases")}
            maxLength={ALIASES_MAX}
            autoComplete="off"
            aria-invalid={invalid("aliases")}
            aria-describedby={described("aliases", true)}
            {...register("aliases")}
          />
          <FieldDescription id={`${id("aliases")}-hint`}>
            Opcional. También se busca por acá.
          </FieldDescription>
          <FieldError id={`${id("aliases")}-error`}>{errors.aliases?.message}</FieldError>
        </Field>

        <div className="grid items-start gap-5 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
          <Field>
            <Label htmlFor={id("documentType")}>Tipo de documento</Label>
            <Select
              id={id("documentType")}
              aria-invalid={invalid("documentType")}
              aria-describedby={described("documentType")}
              {...register("documentType", { onChange: () => setCheckedNumber(null) })}
            >
              <option value="">Sin documento</option>
              {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <FieldError id={`${id("documentType")}-error`}>
              {errors.documentType?.message}
            </FieldError>
          </Field>
          <Field>
            <Label htmlFor={id("documentNumber")}>Número de documento</Label>
            <Input
              id={id("documentNumber")}
              inputMode="text"
              maxLength={DOCUMENT_MAX}
              autoComplete="off"
              className="tabular-nums"
              aria-invalid={invalid("documentNumber")}
              aria-describedby={described("documentNumber", true)}
              {...register("documentNumber", { onBlur: checkDocument })}
            />
            <FieldDescription id={`${id("documentNumber")}-hint`}>
              {person
                ? "Opcional. Con o sin puntos."
                : "Opcional. Con o sin puntos. Al salir del campo lo buscamos entre las personas del estudio."}
            </FieldDescription>
            <FieldError id={`${id("documentNumber")}-error`}>
              {errors.documentNumber?.message}
            </FieldError>
          </Field>
        </div>

        {!person && conflict.isPending && (
          <p role="status" className="flex items-center gap-2 text-meta text-muted-foreground">
            <LoaderCircle
              aria-hidden="true"
              className="size-5 animate-spin motion-reduce:animate-none"
            />
            Buscando ese documento en el estudio
          </p>
        )}
        {!person && conflict.isError && (
          <p role="alert" className="text-meta text-muted-foreground">
            No pudimos buscar ese documento en el estudio. Igual podés guardar, y hacer el control
            de conflicto después desde Personas.
          </p>
        )}
        {showConflict && conflict.data && (
          <ConflictMatches
            matches={conflict.data.matches}
            disclaimer={conflict.data.disclaimer}
            linkPersons={false}
            live
          />
        )}

        {human && (
          <Field className="sm:max-w-xs">
            <Label htmlFor={id("birthDate")}>Fecha de nacimiento</Label>
            <Input
              id={id("birthDate")}
              type="date"
              className="tabular-nums"
              aria-invalid={invalid("birthDate")}
              aria-describedby={described("birthDate", true)}
              {...register("birthDate")}
            />
            <FieldDescription id={`${id("birthDate")}-hint`}>Opcional.</FieldDescription>
            <FieldError id={`${id("birthDate")}-error`}>{errors.birthDate?.message}</FieldError>
          </Field>
        )}

        <div className="grid items-start gap-5 sm:grid-cols-2">
          <Field>
            <Label htmlFor={id("phone")}>Teléfono</Label>
            <Input
              id={id("phone")}
              type="tel"
              inputMode="tel"
              maxLength={PHONE_MAX}
              autoComplete="off"
              className="tabular-nums"
              aria-invalid={invalid("phone")}
              aria-describedby={described("phone")}
              {...register("phone")}
            />
            <FieldError id={`${id("phone")}-error`}>{errors.phone?.message}</FieldError>
          </Field>
          <Field>
            <Label htmlFor={id("email")}>Email</Label>
            <Input
              id={id("email")}
              type="email"
              inputMode="email"
              maxLength={EMAIL_MAX}
              autoComplete="off"
              aria-invalid={invalid("email")}
              aria-describedby={described("email")}
              {...register("email")}
            />
            <FieldError id={`${id("email")}-error`}>{errors.email?.message}</FieldError>
          </Field>
          <Field>
            <Label htmlFor={id("nationality")}>Nacionalidad</Label>
            <Input
              id={id("nationality")}
              maxLength={NATIONALITY_MAX}
              autoComplete="off"
              aria-invalid={invalid("nationality")}
              aria-describedby={described("nationality")}
              {...register("nationality")}
            />
            <FieldError id={`${id("nationality")}-error`}>{errors.nationality?.message}</FieldError>
          </Field>
          <Field>
            <Label htmlFor={id("address")}>Domicilio</Label>
            <Input
              id={id("address")}
              maxLength={ADDRESS_MAX}
              autoComplete="off"
              aria-invalid={invalid("address")}
              aria-describedby={described("address")}
              {...register("address")}
            />
            <FieldError id={`${id("address")}-error`}>{errors.address?.message}</FieldError>
          </Field>
        </div>
      </form>
    </FormSheet>
  );
}
