import { useId, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CircleAlert, Info, Lock } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cppArticle, detaineeAlertSentence } from "@/features/agenda/agenda-format";
import { useDetaineeAlerts } from "@/features/agenda/agenda-queries";
import type { DetaineeAlert } from "@/features/agenda/agenda-types";

/** How many alerts show before "Mirá los N avisos". */
const VISIBLE = 3;

function AlertItem({ alert }: { alert: DetaineeAlert }) {
  return (
    <li className="grid gap-0.5">
      <p>
        <strong className="font-bold text-detained">{alert.defendantName}</strong>.{" "}
        {detaineeAlertSentence(alert)}
      </p>
      <p className="text-meta text-muted-foreground">
        <Link
          to="/causas/$caseId"
          params={{ caseId: alert.caseId }}
          className="text-primary underline underline-offset-4 hover:decoration-2"
        >
          {alert.caseCaption}
        </Link>
        . {cppArticle(alert.article)}.
      </p>
    </li>
  );
}

/**
 * Assisted alerts about the firm's detained clients, above the agenda: a measure that ends, a
 * review that is due, a year of preventive prison. Liberty first, calmly: one red block, facts,
 * the legal source and the "Cálculo asistido" disclaimer. Nothing shows when there is nothing due.
 */
export function DetaineeAlerts() {
  const alerts = useDetaineeAlerts();
  const titleId = useId();
  const listId = useId();
  const [expanded, setExpanded] = useState(false);

  if (alerts.isError) {
    return (
      <Alert variant="error" role="alert">
        <CircleAlert aria-hidden="true" />
        <AlertTitle>No pudimos cargar los avisos de personas detenidas</AlertTitle>
        <AlertDescription>
          <p>Revisá los plazos de las medidas en cada caso hasta que vuelvan a cargar.</p>
          <Button
            variant="outline"
            className="mt-2 justify-self-start"
            onClick={() => void alerts.refetch()}
          >
            Volvé a intentar
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const list = alerts.data ?? [];
  const [first] = list;
  if (!first) return null;

  const visible = expanded ? list : list.slice(0, VISIBLE);
  const hidden = list.length - VISIBLE;
  // The backend sends the same fixed disclaimer with every alert.
  const { disclaimer } = first;

  return (
    <section aria-labelledby={titleId}>
      <Alert variant="detained">
        <Lock aria-hidden="true" />
        <AlertTitle id={titleId}>
          {list.length === 1
            ? "Un aviso sobre una persona detenida"
            : `${list.length} avisos sobre personas detenidas`}
        </AlertTitle>
        <AlertDescription className="gap-3">
          <ul id={listId} aria-label="Avisos" className="grid gap-3">
            {visible.map((alert) => (
              <AlertItem key={`${alert.measureId}-${alert.kind}`} alert={alert} />
            ))}
          </ul>
          {hidden > 0 && (
            <Button
              variant="link"
              className="-mx-1 justify-self-start px-1"
              aria-expanded={expanded}
              aria-controls={listId}
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded ? "Mostrá menos avisos" : `Mirá los ${list.length} avisos`}
            </Button>
          )}
          <p className="flex items-start gap-2 text-small text-muted-foreground">
            <Info aria-hidden="true" className="mt-0.5 size-4.5 shrink-0" />
            <span>
              <strong className="font-bold">{disclaimer}</strong> El sistema te avisa; la decisión
              es tuya.
            </span>
          </p>
        </AlertDescription>
      </Alert>
    </section>
  );
}
