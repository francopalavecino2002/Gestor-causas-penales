import { useId, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert, LoaderCircle } from "lucide-react";
import { useForm } from "react-hook-form";

import { FormSheet } from "@/components/forms/form-sheet";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ContactView } from "@/features/persons/person-api";
import {
  CONTACT_NAME_MAX,
  contactDataOf,
  contactFormSchema,
  contactFormValues,
  contactProblem,
  EMAIL_MAX,
  MAY_BE_TOLD_MAX,
  PHONE_MAX,
  RELATIONSHIP_MAX,
  type ContactFormField,
  type ContactFormValues,
} from "@/features/persons/person-form-schema";
import { useSaveContact } from "@/features/persons/person-queries";

/**
 * An authorized contact of a client: someone the client allowed the firm to inform (a relative,
 * for example), and what exactly may be told to them.
 */
export function ContactFormDialog({
  clientId,
  clientName,
  contact,
  onClose,
}: {
  clientId: string;
  clientName: string;
  contact?: ContactView;
  onClose: () => void;
}) {
  const formId = useId();
  const save = useSaveContact(clientId, contact?.id);
  const [general, setGeneral] = useState<string | null>(null);
  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: contactFormValues(contact),
  });
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = form;

  const submit = handleSubmit(async (values) => {
    setGeneral(null);
    try {
      await save.mutateAsync(contactDataOf(values));
      onClose();
    } catch (error) {
      const problem = contactProblem(error);
      let first = true;
      for (const [field, message] of Object.entries(problem.fields)) {
        if (!message) continue;
        setError(field as ContactFormField, { message }, { shouldFocus: first });
        first = false;
      }
      setGeneral(problem.general ?? null);
    }
  });

  const id = (name: ContactFormField) => `${formId}-${name}`;
  const described = (name: ContactFormField, hint = false) =>
    [hint ? `${id(name)}-hint` : null, errors[name] ? `${id(name)}-error` : null]
      .filter(Boolean)
      .join(" ") || undefined;
  const invalid = (name: ContactFormField) => (errors[name] ? true : undefined);

  return (
    <FormSheet
      title={contact ? `Editá a ${contact.fullName}` : "Nuevo contacto autorizado"}
      description={`De ${clientName}. Solo se le informa lo que el cliente autorizó.`}
      onClose={onClose}
      className="sm:max-w-xl"
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
            Guardá el contacto
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
        <div className="grid items-start gap-5 sm:grid-cols-2">
          <Field>
            <Label htmlFor={id("fullName")}>Nombre y apellido</Label>
            <Input
              id={id("fullName")}
              maxLength={CONTACT_NAME_MAX}
              autoComplete="off"
              aria-invalid={invalid("fullName")}
              aria-describedby={described("fullName")}
              {...register("fullName")}
            />
            <FieldError id={`${id("fullName")}-error`}>{errors.fullName?.message}</FieldError>
          </Field>
          <Field>
            <Label htmlFor={id("relationship")}>Vínculo</Label>
            <Input
              id={id("relationship")}
              maxLength={RELATIONSHIP_MAX}
              autoComplete="off"
              aria-invalid={invalid("relationship")}
              aria-describedby={described("relationship", true)}
              {...register("relationship")}
            />
            <FieldDescription id={`${id("relationship")}-hint`}>
              Opcional. Por ejemplo: hermana, pareja.
            </FieldDescription>
            <FieldError id={`${id("relationship")}-error`}>
              {errors.relationship?.message}
            </FieldError>
          </Field>
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
        </div>
        <Field>
          <Label htmlFor={id("mayBeTold")}>Qué se le puede informar</Label>
          <Textarea
            id={id("mayBeTold")}
            rows={3}
            maxLength={MAY_BE_TOLD_MAX}
            className="min-h-24"
            aria-invalid={invalid("mayBeTold")}
            aria-describedby={described("mayBeTold", true)}
            {...register("mayBeTold")}
          />
          <FieldDescription id={`${id("mayBeTold")}-hint`}>
            Por ejemplo: fechas de audiencias y su situación de libertad, no el detalle de la causa.
          </FieldDescription>
          <FieldError id={`${id("mayBeTold")}-error`}>{errors.mayBeTold?.message}</FieldError>
        </Field>
      </form>
    </FormSheet>
  );
}
