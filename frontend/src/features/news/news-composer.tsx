import { useId, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert, LoaderCircle, Send } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FieldDescription, FieldError } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  POST_MAX,
  postFormSchema,
  postProblem,
  type PostFormValues,
} from "@/features/news/news-form-schema";
import { useCreatePost } from "@/features/news/news-queries";
import { cn } from "@/lib/utils";

/** From here on the counter reads as a warning (amber, the deadline tone: a limit is near). */
const NEAR_LIMIT = POST_MAX - 100;

/**
 * "Publicá una novedad": a short plain-text notice for the whole firm, up to 1000 characters,
 * with a counter. After posting, the field clears and the post shows first on the wall.
 */
export function NewsComposer({
  textareaId,
  onPosted,
}: {
  /** The text field's id, so the empty wall can move the focus to it. */
  textareaId: string;
  onPosted: () => void;
}) {
  const id = useId();
  const create = useCreatePost();
  const [general, setGeneral] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<PostFormValues>({
    resolver: zodResolver(postFormSchema),
    defaultValues: { body: "" },
  });
  const length = useWatch({ control, name: "body" }).length;

  const submit = handleSubmit(async ({ body }) => {
    setGeneral(null);
    try {
      await create.mutateAsync(body.trim());
      reset({ body: "" });
      onPosted();
    } catch (error) {
      const problem = postProblem(error);
      if (problem.fields.body)
        setError("body", { message: problem.fields.body }, { shouldFocus: true });
      setGeneral(problem.general ?? null);
    }
  });

  const describedBy = [`${id}-help`, `${id}-count`, errors.body ? `${id}-error` : null]
    .filter(Boolean)
    .join(" ");

  return (
    <Card asChild>
      <form noValidate onSubmit={submit} aria-labelledby={`${id}-title`} className="gap-3">
        <h2 id={`${id}-title`} className="sr-only">
          Publicá una novedad
        </h2>
        {general && (
          <Alert variant="error" role="alert">
            <CircleAlert aria-hidden="true" />
            <AlertDescription>{general}</AlertDescription>
          </Alert>
        )}
        <Field>
          <Label htmlFor={textareaId}>Contale algo al estudio</Label>
          <Textarea
            id={textareaId}
            rows={3}
            maxLength={POST_MAX}
            className="min-h-24"
            aria-invalid={errors.body ? true : undefined}
            aria-describedby={describedBy}
            {...register("body")}
          />
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
            <FieldDescription id={`${id}-help`}>
              Lo ven todas las personas del estudio. Solo texto.
            </FieldDescription>
            <p
              id={`${id}-count`}
              className={cn(
                "text-small text-muted-foreground tabular-nums",
                length > NEAR_LIMIT && "font-semibold text-deadline",
              )}
            >
              <span aria-hidden="true">
                {length}/{POST_MAX}
              </span>
              <span className="sr-only">
                {length} de {POST_MAX} caracteres
              </span>
            </p>
          </div>
          <FieldError id={`${id}-error`}>{errors.body?.message}</FieldError>
        </Field>
        <Button type="submit" className="justify-self-end" disabled={isSubmitting}>
          {isSubmitting ? (
            <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
          ) : (
            <Send aria-hidden="true" />
          )}
          Publicá
        </Button>
      </form>
    </Card>
  );
}
