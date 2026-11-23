import { useId, useState, type ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  BellRing,
  BookOpen,
  CalendarPlus,
  CircleAlert,
  CircleOff,
  CirclePause,
  ExternalLink,
  Info,
  LoaderCircle,
  Lock,
  Play,
  Timer,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { AssistedCalculationNote } from "@/components/legal/assisted-calculation-note";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldDescription, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { formatNumericDate } from "@/features/cases/case-format";
import { LoadError } from "@/features/cases/case-states";
import {
  computationLabel,
  FALLBACK_DISCLAIMER,
  FLAG_LABELS,
  KIND_LABELS,
} from "@/features/deadlines/deadline-format";
import {
  alertDaysLabel,
  extensionAllowedLabel,
  SUSPENSION_LABELS,
} from "@/features/settings/settings-copy";
import { settingsErrorMessage } from "@/features/settings/settings-errors";
import { useAnnouncement, useCanEditSettings } from "@/features/settings/settings-hooks";
import { SavedStatus, SettingsPage } from "@/features/settings/settings-layout";
import {
  useChangeDeadlineRuleSetting,
  useDeadlineRules,
} from "@/features/settings/settings-queries";
import type { DeadlineRule } from "@/features/settings/settings-types";

/** Same limit as the backend (DeadlinePackageLoader.MAX_ALERT_DAYS). */
const MAX_ALERT_DAYS = 90;

const alertSchema = z.object({
  alertDaysBefore: z
    .number({ error: "Escribí cuántos días antes querés el aviso." })
    .int("Usá un número entero de días.")
    .min(0, "El aviso no puede ser negativo: 0 es el mismo día que vence.")
    .max(MAX_ALERT_DAYS, `El aviso puede ser de hasta ${MAX_ALERT_DAYS} días antes.`),
});

/** Disabling a rule stops new deadlines with it: ask first, louder for a detainee's rule. */
function DisableDialog({
  rule,
  pending,
  error,
  onConfirm,
  onClose,
}: {
  rule: DeadlineRule;
  pending: boolean;
  error: unknown;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Desactivás {rule.name}?</DialogTitle>
          <DialogDescription>
            No se van a poder cargar plazos nuevos con esta regla y los que ya están dejan de
            aparecer en Plazos (siguen en cada causa). Podés volver a activarla cuando quieras.
          </DialogDescription>
        </DialogHeader>
        {rule.detainee && (
          <Alert variant="detained">
            <Lock aria-hidden="true" />
            <AlertDescription>
              Este plazo protege a una persona privada de su libertad. Si lo desactivás, el sistema
              no te va a avisar cuando venza.
            </AlertDescription>
          </Alert>
        )}
        {error ? (
          <Alert variant="error" role="alert">
            <CircleAlert aria-hidden="true" />
            <AlertDescription>{settingsErrorMessage(error)}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancelá</Button>
          </DialogClose>
          <Button disabled={pending} onClick={onConfirm}>
            {pending && <LoaderCircle aria-hidden="true" className="animate-spin" />}
            Desactivá la regla
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The two settings a firm can change, for the owner: on/off and the warning window. */
function RuleControls({ rule }: { rule: DeadlineRule }) {
  const id = useId();
  const change = useChangeDeadlineRuleSetting();
  const [message, announce] = useAnnouncement();
  const [confirming, setConfirming] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof alertSchema>>({
    resolver: zodResolver(alertSchema),
    values: { alertDaysBefore: rule.alertDaysBefore },
  });

  const save = (enabled: boolean, alertDaysBefore: number, done: string) => {
    announce(null);
    change.mutate(
      { code: rule.code, setting: { enabled, alertDaysBefore } },
      {
        onSuccess: () => {
          setConfirming(false);
          announce(done);
        },
      },
    );
  };

  const toggle = (enabled: boolean) => {
    if (enabled) save(true, rule.alertDaysBefore, "Guardado: la regla está activa.");
    else {
      change.reset();
      setConfirming(true);
    }
  };

  return (
    <div className="grid gap-3 border-t pt-3">
      <div className="flex min-h-11 items-center gap-3">
        <Switch
          id={`${id}-enabled`}
          checked={rule.enabled}
          disabled={change.isPending}
          onCheckedChange={toggle}
        />
        <Label htmlFor={`${id}-enabled`} className="cursor-pointer">
          Activa en el estudio
        </Label>
      </div>

      {rule.enabled && (
        <form
          noValidate
          onSubmit={handleSubmit(({ alertDaysBefore }) =>
            save(
              true,
              alertDaysBefore,
              `Guardado: te avisamos ${alertDaysLabel(alertDaysBefore)}.`,
            ),
          )}
          className="grid gap-1.5"
        >
          <Label htmlFor={`${id}-alert`}>Días de aviso antes del vencimiento</Label>
          <div className="flex flex-wrap items-start gap-2">
            <Input
              id={`${id}-alert`}
              type="number"
              inputMode="numeric"
              min={0}
              max={MAX_ALERT_DAYS}
              step={1}
              className="w-24 tabular-nums"
              aria-invalid={errors.alertDaysBefore ? true : undefined}
              aria-describedby={
                errors.alertDaysBefore ? `${id}-alert-help ${id}-alert-error` : `${id}-alert-help`
              }
              {...register("alertDaysBefore", { valueAsNumber: true })}
            />
            <Button type="submit" variant="outline" disabled={change.isPending}>
              {change.isPending && <LoaderCircle aria-hidden="true" className="animate-spin" />}
              Guardá el aviso
            </Button>
          </div>
          <FieldDescription id={`${id}-alert-help`}>
            Desde entonces figura en «Vencen pronto». 0 es el mismo día que vence. Sugerido por la
            norma: {alertDaysLabel(rule.defaultAlertDaysBefore)}.
          </FieldDescription>
          <FieldError id={`${id}-alert-error`}>{errors.alertDaysBefore?.message}</FieldError>
        </form>
      )}

      <SavedStatus message={message} />
      {change.isError && !confirming && (
        <Alert variant="error" role="alert">
          <CircleAlert aria-hidden="true" />
          <AlertDescription>{settingsErrorMessage(change.error)}</AlertDescription>
        </Alert>
      )}

      {confirming && (
        <DisableDialog
          rule={rule}
          pending={change.isPending}
          error={change.error}
          onConfirm={() =>
            save(false, rule.alertDaysBefore, "Guardado: la regla está desactivada.")
          }
          onClose={() => setConfirming(false)}
        />
      )}
    </div>
  );
}

interface MetaRow {
  icon: LucideIcon;
  term: string;
  value: ReactNode;
}

/** Case law status, when it was last reviewed and the press note (new tab), as in DeadlineCard. */
function CaseLawValue({ caseLaw }: { caseLaw: NonNullable<DeadlineRule["caseLaw"]> }) {
  return (
    <>
      {caseLaw.status}
      {caseLaw.reviewedOn && (
        <span className="text-muted-foreground tabular-nums">
          {" "}
          (revisada el {formatNumericDate(caseLaw.reviewedOn)})
        </span>
      )}
      {caseLaw.url && (
        <>
          {" "}
          <a
            href={caseLaw.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-primary underline underline-offset-4 hover:decoration-2"
          >
            Leé la nota
            <ExternalLink aria-hidden="true" className="size-4 shrink-0" />
            <span className="sr-only"> (se abre en otra pestaña)</span>
          </a>
        </>
      )}
    </>
  );
}

function RuleCard({ rule, canEdit }: { rule: DeadlineRule; canEdit: boolean }) {
  const titleId = useId();
  const meta: MetaRow[] = [
    { icon: Play, term: "Corre desde", value: rule.trigger },
    {
      icon: Timer,
      term: "Cómo se cuenta",
      value: `${KIND_LABELS[rule.kind]}: ${computationLabel(rule.computation, rule.duration)}`,
    },
    { icon: TriangleAlert, term: "Si vence", value: rule.consequence },
  ];
  if (rule.extensions.length > 0) {
    meta.push({
      icon: CalendarPlus,
      term: "Prórrogas posibles",
      value: (
        <>
          {rule.extensions.map((extension, index) => (
            <span key={index} className="block">
              {extensionAllowedLabel(extension, rule.computation)}
            </span>
          ))}
        </>
      ),
    });
  }
  if (rule.suspendedBy.length > 0) {
    meta.push({
      icon: CirclePause,
      term: "Se suspende por",
      value: rule.suspendedBy.map((kind) => SUSPENSION_LABELS[kind]).join(", "),
    });
  }
  if (rule.caseLaw?.status) {
    meta.push({
      icon: BookOpen,
      term: "Jurisprudencia",
      value: <CaseLawValue caseLaw={rule.caseLaw} />,
    });
  }
  if (!canEdit) {
    meta.push({
      icon: BellRing,
      term: "Aviso",
      value: rule.enabled ? alertDaysLabel(rule.alertDaysBefore) : "Sin aviso: regla desactivada",
    });
  }

  return (
    <Card edge={rule.detainee && rule.enabled ? "detained" : "none"} asChild>
      <article aria-labelledby={titleId}>
        {(rule.detainee || !rule.enabled) && (
          <CardHeader className="justify-start gap-x-2">
            {rule.detainee && (
              <Badge variant="detained">
                <Lock aria-hidden="true" />
                Persona detenida
              </Badge>
            )}
            {!rule.enabled && (
              <Badge variant="neutral">
                <CircleOff aria-hidden="true" />
                Desactivada en el estudio
              </Badge>
            )}
          </CardHeader>
        )}
        <div className="grid min-w-0 gap-0.5">
          <CardTitle as="h3" id={titleId}>
            {rule.name}
          </CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-x-2 gap-y-1 tabular-nums">
            <span>{rule.source}</span>
            {rule.flags.map((flag) => (
              <span key={flag} className="font-bold whitespace-nowrap text-deadline">
                {FLAG_LABELS[flag]}
              </span>
            ))}
          </CardDescription>
        </div>
        <CardContent asChild>
          <dl className="text-meta">
            {meta.map(({ icon: Icon, term, value }) => (
              <div key={term} className="relative min-w-0 pl-6.5">
                <Icon
                  aria-hidden="true"
                  className="absolute top-0.75 left-0 size-4.5 text-muted-foreground"
                />
                <dt className="inline text-muted-foreground">{term}: </dt>
                <dd className="inline">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
        {rule.note && (
          <p className="max-w-prose text-small text-muted-foreground">
            <span className="font-bold">Nota: </span>
            {rule.note}
          </p>
        )}
        <p className="flex items-start gap-2 text-small text-muted-foreground">
          <Info aria-hidden="true" className="mt-0.5 size-4.5 shrink-0" />
          <span>
            <strong className="font-bold">{rule.disclaimer.trim() || FALLBACK_DISCLAIMER}</strong>{" "}
            El cálculo y la fuente no se editan; vienen de la norma.
          </span>
        </p>
        {canEdit && <RuleControls rule={rule} />}
      </article>
    </Card>
  );
}

function RulesSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Cargando las reglas" className="grid gap-3">
      {[0, 1, 2].map((index) => (
        <div key={index} className="grid gap-2.5 rounded-xl border bg-card px-4 pt-3.5 pb-4">
          <Skeleton className="h-6 w-3/5" />
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-16 w-full" />
        </div>
      ))}
    </div>
  );
}

function RuleGroup({
  title,
  description,
  rules,
  canEdit,
}: {
  title: string;
  description: string;
  rules: DeadlineRule[];
  canEdit: boolean;
}) {
  const titleId = useId();
  if (rules.length === 0) return null;
  return (
    <section aria-labelledby={titleId} className="grid gap-3">
      <div className="grid gap-1">
        <h2 id={titleId} className="text-title font-bold">
          {title}
        </h2>
        <p className="max-w-prose text-meta text-muted-foreground">{description}</p>
      </div>
      <div className="grid gap-3.5">
        {rules.map((rule) => (
          <RuleCard key={rule.code} rule={rule} canEdit={canEdit} />
        ))}
      </div>
    </section>
  );
}

/** `/ajustes/plazos`: the built-in rules; a firm only turns them on or off and sets the warning. */
export function DeadlineRulesSection() {
  const canEdit = useCanEditSettings();
  const rules = useDeadlineRules();
  const all = rules.data ?? [];

  return (
    <SettingsPage
      section="/ajustes/plazos"
      intro="Las reglas vienen del CPP de Neuquén y no se editan. Tu estudio puede desactivar las que no usa y elegir con cuántos días de anticipación ver cada plazo."
    >
      <AssistedCalculationNote className="max-w-3xl" />
      {rules.isPending ? (
        <RulesSkeleton />
      ) : rules.isError ? (
        <LoadError
          title="No pudimos cargar las reglas de plazos"
          error={rules.error}
          onRetry={() => void rules.refetch()}
        />
      ) : (
        <div className="grid max-w-3xl gap-7">
          <RuleGroup
            title="Personas detenidas"
            description="Plazos que protegen a una persona privada de su libertad."
            rules={all.filter((rule) => rule.detainee)}
            canEdit={canEdit}
          />
          <RuleGroup
            title="Otros plazos"
            description="Plazos del proceso que no dependen de una detención."
            rules={all.filter((rule) => !rule.detainee)}
            canEdit={canEdit}
          />
        </div>
      )}
    </SettingsPage>
  );
}
