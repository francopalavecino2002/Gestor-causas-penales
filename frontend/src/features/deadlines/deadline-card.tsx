import { useId, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  BookOpen,
  CalendarPlus,
  CalendarX,
  CircleAlert,
  CircleCheck,
  CirclePause,
  ExternalLink,
  Folder,
  Hourglass,
  Info,
  Lock,
  Play,
  Timer,
  TriangleAlert,
  User,
  type LucideIcon,
} from "lucide-react";

import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  computationLabel,
  dueLabel,
  dueLead,
  extensionDetail,
  extensionsLabel,
  FALLBACK_DISCLAIMER,
  FLAG_LABELS,
  isHourBased,
  isUrgent,
  KIND_LABELS,
  notCalculableText,
  remainingLabel,
  STATUS_LABELS,
  suspendedDaysLabel,
  triggeredLabel,
} from "@/features/deadlines/deadline-format";
import type { DeadlineStatus, DeadlineView } from "@/features/deadlines/deadline-types";
import { formatNumericDate } from "@/features/cases/case-format";
import { cn } from "@/lib/utils";

const STATUS_BADGES: Record<DeadlineStatus, { variant: BadgeVariant; icon?: LucideIcon }> = {
  OVERDUE: { variant: "deadline", icon: CircleAlert },
  DUE_SOON: { variant: "deadline", icon: Hourglass },
  RUNNING: { variant: "neutral", icon: Hourglass },
  NOT_CALCULABLE: { variant: "outline", icon: CalendarX },
  // Status tones draw their own dot.
  SUSPENDED: { variant: "suspendida" },
  MET: { variant: "efectiva" },
};

export function DeadlineStatusBadge({ status }: { status: DeadlineStatus }) {
  const { variant, icon: Icon } = STATUS_BADGES[status];
  return (
    <Badge variant={variant}>
      {Icon && <Icon aria-hidden="true" />}
      {STATUS_LABELS[status]}
    </Badge>
  );
}

/** Red, with the lock: the rule protects someone deprived of liberty. */
function DetaineeRuleBadge() {
  return (
    <Badge variant="detained">
      <Lock aria-hidden="true" />
      Persona detenida
    </Badge>
  );
}

interface MetaRow {
  icon: LucideIcon;
  term: string;
  value: ReactNode;
  /** Show the term as a label ("Si vence: …"); otherwise it is for screen readers only. */
  visibleTerm?: boolean;
}

/** The due date, how far it is, or why there is none: the first thing a lawyer reads. */
function DueBlock({ deadline, timeZone }: { deadline: DeadlineView; timeZone: string }) {
  const due = dueLabel(deadline, timeZone);
  const remaining = remainingLabel(deadline);
  const urgent = isUrgent(deadline.status);

  if (deadline.status === "NOT_CALCULABLE") {
    return (
      <p className="flex items-start gap-2 text-meta">
        <CalendarX aria-hidden="true" className="mt-0.75 size-4.5 shrink-0 text-muted-foreground" />
        <span>{notCalculableText(deadline.missingYear)}</span>
      </p>
    );
  }
  if (deadline.status === "SUSPENDED") {
    return (
      <p className="flex items-start gap-2 text-meta">
        <CirclePause
          aria-hidden="true"
          className="mt-0.75 size-4.5 shrink-0 text-muted-foreground"
        />
        <span>
          Una suspensión cargada en la causa detuvo el plazo: no corre mientras dure. Cuando se
          levante, se vuelve a calcular.
        </span>
      </p>
    );
  }

  return (
    <div className="grid gap-0.5">
      {due && (
        <p className="text-body">
          <span className="text-muted-foreground">
            {dueLead(deadline.status)}
          </span>
          <time
            dateTime={
              isHourBased(deadline) ? (deadline.dueAt ?? undefined) : (deadline.dueOn ?? undefined)
            }
            className="font-bold"
          >
            {due.charAt(0).toLocaleLowerCase("es-AR") + due.slice(1)}
          </time>
          {!isHourBased(deadline) && deadline.dueOn && (
            <span className="text-muted-foreground"> (hasta las 24)</span>
          )}
        </p>
      )}
      {deadline.status === "MET" && deadline.metOn && (
        <p className="flex items-center gap-2 text-meta font-semibold text-status-efectiva">
          <CircleCheck aria-hidden="true" className="size-4.5 shrink-0" />
          Cumplido el {formatNumericDate(deadline.metOn)}
        </p>
      )}
      {remaining && (
        <p
          className={cn("text-card-title font-bold", urgent ? "text-deadline" : "text-foreground")}
        >
          {remaining}
        </p>
      )}
    </div>
  );
}

/**
 * One deadline: status, rule, legal source with its review tags, due date and what is left,
 * who and which case, how it is counted, what happens if it ends, extensions, suspensions, case
 * law and, always, the "Cálculo asistido" disclaimer from the API. Detainee rules get the red
 * edge and the "Persona detenida" badge; overdue and due-soon ones the amber edge.
 */
export function DeadlineCard({
  deadline,
  timeZone,
  headingLevel = "h3",
  showCase = true,
}: {
  deadline: DeadlineView;
  timeZone: string;
  headingLevel?: "h3" | "h4";
  /** Off inside the case's own page, where the link would lead to itself. */
  showCase?: boolean;
}) {
  const titleId = useId();
  const { rule } = deadline;
  const urgent = isUrgent(deadline.status);
  const edge = rule.detainee ? "detained" : urgent ? "deadline" : "none";

  const meta: MetaRow[] = [];
  if (deadline.defendantName) {
    meta.push({
      icon: User,
      term: "Imputado o imputada",
      value: <span className="font-semibold">{deadline.defendantName}</span>,
    });
  }
  if (showCase) {
    meta.push({
      icon: Folder,
      term: "Causa",
      value: (
        <Link
          to="/causas/$caseId"
          params={{ caseId: deadline.caseId }}
          className="text-primary underline underline-offset-4 hover:decoration-2"
        >
          {deadline.caseCaption}
        </Link>
      ),
    });
  }
  meta.push({
    icon: Timer,
    term: "Cómo se cuenta",
    value: `${KIND_LABELS[rule.kind]}: ${computationLabel(rule.computation, deadline.amount)}`,
  });
  meta.push({
    icon: Play,
    term: "Corre desde",
    visibleTerm: true,
    value: <span className="tabular-nums">{triggeredLabel(deadline, timeZone)}</span>,
  });
  meta.push({ icon: TriangleAlert, term: "Si vence", visibleTerm: true, value: rule.consequence });
  if (deadline.extensions.length > 0) {
    meta.push({
      icon: CalendarPlus,
      term: "Prórrogas",
      value: (
        <>
          <span className="block">{extensionsLabel(deadline.extensions)}</span>
          {deadline.extensions.map((extension) => (
            <span key={extension.id} className="block text-muted-foreground">
              {extensionDetail(extension, rule.computation)}
            </span>
          ))}
        </>
      ),
    });
  }
  if (deadline.suspendedDays > 0) {
    meta.push({
      icon: CirclePause,
      term: "Suspensiones",
      value: suspendedDaysLabel(deadline.suspendedDays),
    });
  }
  if (rule.caseLawStatus) {
    meta.push({
      icon: BookOpen,
      term: "Jurisprudencia",
      visibleTerm: true,
      value: (
        <>
          {rule.caseLawStatus}
          {rule.caseLawUrl && (
            <>
              {" "}
              <a
                href={rule.caseLawUrl}
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
      ),
    });
  }

  return (
    <Card edge={edge} asChild>
      <article aria-labelledby={titleId}>
        <CardHeader className="justify-start gap-x-2">
          <DeadlineStatusBadge status={deadline.status} />
          {rule.detainee && <DetaineeRuleBadge />}
          {!rule.enabled && <Badge variant="neutral">Regla desactivada en el estudio</Badge>}
        </CardHeader>
        <div className="grid min-w-0 gap-0.5">
          <CardTitle as={headingLevel} id={titleId}>
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
        <DueBlock deadline={deadline} timeZone={timeZone} />
        <CardContent asChild>
          <dl className="text-meta">
            {meta.map(({ icon: Icon, term, value, visibleTerm }) => (
              <div key={term} className="relative min-w-0 pl-6.5">
                <Icon
                  aria-hidden="true"
                  className="absolute top-0.75 left-0 size-4.5 text-muted-foreground"
                />
                <dt className={visibleTerm ? "inline text-muted-foreground" : "sr-only"}>
                  {visibleTerm ? `${term}: ` : term}
                </dt>
                <dd className="inline">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
        <p className="flex items-start gap-2 border-t pt-2.5 text-small text-muted-foreground">
          <Info aria-hidden="true" className="mt-0.5 size-4.5 shrink-0" />
          <span>
            <strong className="font-bold">{deadline.disclaimer.trim() || FALLBACK_DISCLAIMER}</strong> El sistema propone la
            fecha; la decisión es tuya.
          </span>
        </p>
      </article>
    </Card>
  );
}
