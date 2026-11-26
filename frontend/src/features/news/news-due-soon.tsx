import { useId } from "react";
import { Link } from "@tanstack/react-router";
import { Folder, Hourglass, Info, Lock, User } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import {
  detaineeFirst,
  dueText,
  FALLBACK_DISCLAIMER,
  remainingText,
} from "@/features/news/news-format";
import { NEWS_LINK_CLASS } from "@/features/news/news-entry";
import type { DeadlineAlert } from "@/features/news/news-types";
import { cn } from "@/lib/utils";

function Disclaimer({ text }: { text: string }) {
  return (
    <p className="flex items-start gap-2 text-small text-muted-foreground">
      <Info aria-hidden="true" className="mt-0.5 size-4.5 shrink-0" />
      <span>
        <strong className="font-bold">{text.trim() || FALLBACK_DISCLAIMER}</strong> El sistema
        propone la fecha; la decisión es tuya.
      </span>
    </p>
  );
}

function DueSoonCard({
  alert,
  timeZone,
  showDisclaimer,
}: {
  alert: DeadlineAlert;
  timeZone: string;
  showDisclaimer: boolean;
}) {
  const titleId = useId();
  const remaining = remainingText(alert, timeZone);
  return (
    <Card edge={alert.detainee ? "detained" : "deadline"} asChild>
      <article aria-labelledby={titleId}>
        {alert.detainee && (
          <Badge variant="detained">
            <Lock aria-hidden="true" />
            Persona detenida
          </Badge>
        )}
        <div className="grid min-w-0 gap-0.5">
          <CardTitle id={titleId}>{alert.ruleName}</CardTitle>
          <CardDescription className="tabular-nums">{alert.source}</CardDescription>
        </div>
        <div className="grid gap-0.5">
          {remaining && <p className="text-card-title font-bold text-deadline">{remaining}</p>}
          <p className="text-meta text-muted-foreground tabular-nums">
            <time dateTime={alert.dueAt ?? alert.dueOn}>{dueText(alert, timeZone)}</time>
          </p>
        </div>
        <div className="grid gap-1 text-meta">
          {alert.defendantName && (
            <p className="flex min-w-0 items-start gap-2">
              <User aria-hidden="true" className="mt-0.75 size-4.5 shrink-0 text-muted-foreground" />
              <span className="sr-only">Imputado o imputada:</span>
              <span className="font-semibold">{alert.defendantName}</span>
            </p>
          )}
          <p className="flex min-w-0 items-start gap-2">
            <Folder aria-hidden="true" className="mt-0.75 size-4.5 shrink-0 text-muted-foreground" />
            <span className="sr-only">Causa:</span>
            <Link
              to="/causas/$caseId"
              params={{ caseId: alert.caseId }}
              className={cn(NEWS_LINK_CLASS, "break-words")}
            >
              {alert.caseCaption}
            </Link>
          </p>
        </div>
        {showDisclaimer && (
          <div className="border-t pt-2.5">
            <Disclaimer text={alert.disclaimer} />
          </div>
        )}
      </article>
    </Card>
  );
}

/**
 * "Vencen pronto": running deadlines inside their alert window, those of people deprived of
 * liberty first (red edge and badge), each with its legal source and the "Cálculo asistido"
 * disclaimer. Nothing shows when nothing is due soon.
 */
export function NewsDueSoon({
  alerts,
  timeZone,
  className,
}: {
  alerts: DeadlineAlert[];
  timeZone: string;
  className?: string;
}) {
  const titleId = useId();
  if (alerts.length === 0) return null;
  const sorted = detaineeFirst(alerts);
  // The backend sends one fixed disclaimer; say it once unless some rule has its own.
  const [first] = sorted;
  const uniform = sorted.every((alert) => alert.disclaimer === first?.disclaimer);

  return (
    <section aria-labelledby={titleId} className={cn("grid content-start gap-3", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h2 id={titleId} className="flex items-center gap-2 text-title font-bold">
          <Hourglass aria-hidden="true" className="size-5.5 text-deadline" />
          Vencen pronto
        </h2>
        <Link
          to="/plazos"
          className={cn(NEWS_LINK_CLASS, "inline-flex min-h-11 items-center text-meta font-semibold")}
        >
          Mirá todos los plazos
        </Link>
      </div>
      <ul className="grid gap-3">
        {sorted.map((alert) => (
          <li key={alert.id}>
            <DueSoonCard alert={alert} timeZone={timeZone} showDisclaimer={!uniform} />
          </li>
        ))}
      </ul>
      {uniform && first && <Disclaimer text={first.disclaimer} />}
    </section>
  );
}
