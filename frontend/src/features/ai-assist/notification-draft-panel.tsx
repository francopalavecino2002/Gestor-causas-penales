import { useId, useState } from "react";
import { CircleAlert, LoaderCircle, Sparkles } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NOTIFICATION_TEXT_MAX, type HearingDraft } from "@/features/ai-assist/ai-assist-api";
import { hearingDraftErrorMessage } from "@/features/ai-assist/ai-assist-errors";
import { useAiAssist, useHearingDraft } from "@/features/ai-assist/ai-assist-queries";

/** How each field the draft may miss reads in a sentence. */
const FIELD_NAMES: Record<string, string> = {
  typeCode: "el tipo de audiencia",
  date: "el día",
  time: "la hora",
  room: "la sala",
  judge: "el juez o jueza",
  ofijuReference: "la referencia de la OFIJU",
};

function listInSpanish(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} y ${items.at(-1)}`;
}

/** How many of the form's fields the draft fills. */
function filledCount(draft: HearingDraft): number {
  return [
    draft.typeCode,
    draft.date,
    draft.time,
    draft.durationMinutes,
    draft.room,
    draft.judge,
    draft.ofijuReference,
  ].filter((value) => value !== null && value !== undefined).length;
}

/**
 * "Completá desde una notificación": the lawyer pastes the OFIJU or SINE text and the AI fills the
 * hearing form. Nothing is saved here; the lawyer reviews every field and saves the form as usual.
 */
export function NotificationDraftPanel({
  caseId,
  onDraft,
}: {
  caseId: string;
  onDraft: (draft: HearingDraft) => void;
}) {
  const id = useId();
  const { data: status } = useAiAssist();
  const draft = useHearingDraft();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [empty, setEmpty] = useState(false);

  if (!status?.available || !status.enabled) return null;

  const read = () => {
    if (text.trim() === "") {
      setEmpty(true);
      return;
    }
    setEmpty(false);
    draft.mutate({ caseId, text }, { onSuccess: onDraft });
  };

  const result = draft.data;
  const missing = (result?.missing ?? []).flatMap((field) => FIELD_NAMES[field] ?? []);

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="grid gap-3 rounded-xl border border-dashed bg-secondary/60 p-4"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Sparkles aria-hidden="true" className="size-5 shrink-0 text-primary" />
        <h3 id={`${id}-title`} className="text-body font-semibold">
          Completá desde una notificación
        </h3>
        <Badge variant="outline">Opcional · IA</Badge>
        {!open && (
          <Button
            type="button"
            variant="outline"
            className="ml-auto"
            aria-expanded={false}
            aria-controls={`${id}-body`}
            onClick={() => setOpen(true)}
          >
            Pegá una notificación
          </Button>
        )}
      </div>

      {open && (
        <div id={`${id}-body`} className="grid gap-3">
          <Field>
            <Label htmlFor={`${id}-text`}>Texto de la notificación</Label>
            <Textarea
              id={`${id}-text`}
              value={text}
              rows={5}
              maxLength={NOTIFICATION_TEXT_MAX}
              aria-invalid={empty ? true : undefined}
              aria-describedby={empty ? `${id}-hint ${id}-error` : `${id}-hint`}
              onChange={(event) => setText(event.target.value)}
            />
            <FieldDescription id={`${id}-hint`}>
              Pegá la cédula o el mail de la OFIJU o del SINE. El texto se envía a {status.provider}{" "}
              para leerlo y no se guarda. Usá solo datos ficticios hasta tener la revisión legal.
            </FieldDescription>
            <FieldError id={`${id}-error`}>
              {empty ? "Pegá el texto de la notificación." : undefined}
            </FieldError>
          </Field>
          <Button
            type="button"
            variant="outline"
            className="w-fit"
            disabled={draft.isPending}
            onClick={read}
          >
            {draft.isPending ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" />
            ) : (
              <Sparkles aria-hidden="true" />
            )}
            Completá con IA
          </Button>
        </div>
      )}

      <div role="status" className="empty:hidden">
        {result && !draft.isPending && (
          <Alert>
            <Sparkles aria-hidden="true" />
            <AlertTitle>
              {filledCount(result) === 0
                ? "La IA no encontró datos de una audiencia en ese texto"
                : "Revisá cada dato antes de guardar: la IA puede equivocarse"}
            </AlertTitle>
            <AlertDescription>
              {filledCount(result) > 0 &&
                "Completamos el formulario con lo que dice la notificación. "}
              {missing.length > 0 && `No encontramos ${listInSpanish(missing)}: cargalo a mano.`}
            </AlertDescription>
          </Alert>
        )}
      </div>
      {draft.isError && (
        <Alert variant="error" role="alert">
          <CircleAlert aria-hidden="true" />
          <AlertDescription>{hearingDraftErrorMessage(draft.error)}</AlertDescription>
        </Alert>
      )}
    </section>
  );
}
