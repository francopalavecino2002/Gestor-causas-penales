import { useId, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert, LoaderCircle } from "lucide-react";
import { FormProvider, useForm, type FieldPath } from "react-hook-form";
import { z } from "zod";

import { FormSheet } from "@/components/forms/form-sheet";
import { FormSkeleton } from "@/components/forms/form-skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { catalogOptionLabel } from "@/features/catalogs/catalog-format";
import { useCatalogOptions } from "@/features/catalogs/catalog-queries";
import { partyProblem, personProblem } from "@/features/cases/case-form-errors";
import { useAddParty, useCreatePerson } from "@/features/cases/case-mutations";
import { PersonFields } from "@/features/persons/person-fields";
import {
  checkPersonChoice,
  EMPTY_PERSON_CHOICE,
  newPersonOf,
  personChoiceSchema,
} from "@/features/persons/person-schema";

/** A defendant is not a party: criminal cases add them from «Imputados». */
const DEFENDANT_ROLE = "imputado";

const partyFormSchema = z
  .object({ person: personChoiceSchema, roleCode: z.string().min(1, "Elegí el rol.") })
  .superRefine((value, ctx) => checkPersonChoice(value.person, ctx, ["person"]));

type PartyFormValues = z.output<typeof partyFormSchema>;

/**
 * "Agregá una parte": a person of the firm (or a new one) with a role of the case's area
 * (actor, demandado, víctima, testigo...). `defaultRole` is preselected, e.g. the side the firm
 * represents.
 */
export function PartyFormDialog({
  caseId,
  area,
  defaultRole,
  onClose,
}: {
  caseId: string;
  area: string;
  defaultRole?: string;
  onClose: () => void;
}) {
  const formId = useId();
  const roles = useCatalogOptions("party-roles", undefined, area);
  const offered = roles.items.filter((item) => item.code !== DEFENDANT_ROLE);
  const createPerson = useCreatePerson();
  const addParty = useAddParty();
  const [general, setGeneral] = useState<string | null>(null);
  const firstRole =
    offered.find((item) => item.code === defaultRole)?.code ?? offered[0]?.code ?? "";

  // RHF compares `values` by content, so a new object on each render does not reset the form.
  const loaded = firstRole ? { person: EMPTY_PERSON_CHOICE, roleCode: firstRole } : undefined;
  const form = useForm<PartyFormValues>({
    resolver: zodResolver(partyFormSchema),
    defaultValues: { person: EMPTY_PERSON_CHOICE, roleCode: firstRole },
    // The roles load after the sheet opens: start on the default one when they arrive.
    values: loaded,
    resetOptions: { keepDirtyValues: true },
  });
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = form;

  const markFields = (fields: Partial<Record<string, string>>, prefix = "") => {
    let first = true;
    for (const [field, message] of Object.entries(fields)) {
      if (!message) continue;
      setError(
        `${prefix}${field}` as FieldPath<PartyFormValues>,
        { message },
        { shouldFocus: first },
      );
      first = false;
    }
  };

  const submit = handleSubmit(async (values) => {
    setGeneral(null);
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
      await addParty.mutateAsync({ caseId, data: { personId, roleCode: values.roleCode } });
      onClose();
    } catch (error) {
      const problem = partyProblem(error);
      markFields(problem.fields);
      setGeneral(problem.general ?? null);
    }
  });

  const roleId = `${formId}-role`;
  const ready = !roles.isPending;

  return (
    <FormSheet
      title="Agregá una parte"
      description="Buscá a la persona entre las del estudio o cargala si es nueva."
      onClose={onClose}
      busy={!ready}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelá
          </Button>
          <Button type="submit" form={formId} disabled={!ready || isSubmitting}>
            {isSubmitting && <LoaderCircle aria-hidden="true" className="animate-spin" />}
            Agregá la parte
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
            <PersonFields legend="¿Quién es?" />
            <Field>
              <Label htmlFor={roleId}>Rol en la causa</Label>
              <Select
                id={roleId}
                aria-invalid={errors.roleCode ? true : undefined}
                aria-describedby={errors.roleCode || roles.isError ? `${roleId}-error` : undefined}
                {...register("roleCode")}
              >
                {offered.length === 0 && <option value="">Sin roles para elegir</option>}
                {offered.map((item) => (
                  <option key={item.code} value={item.code}>
                    {catalogOptionLabel(item)}
                  </option>
                ))}
              </Select>
              <FieldError id={`${roleId}-error`}>
                {errors.roleCode?.message ??
                  (roles.isError
                    ? "No pudimos cargar los roles. Cerrá y volvé a abrir el formulario."
                    : undefined)}
              </FieldError>
            </Field>
          </form>
        </FormProvider>
      )}
    </FormSheet>
  );
}
