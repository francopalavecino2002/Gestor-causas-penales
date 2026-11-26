import { useId, type ReactNode } from "react";
import {
  BookOpen,
  CalendarDays,
  CalendarX,
  Hourglass,
  Info,
  Lock,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { reviewTags } from "@/features/catalogs/catalog-format";
import { computationLabel, FALLBACK_DISCLAIMER } from "@/features/deadlines/deadline-format";
import {
  dueParts,
  notLoadedTitle,
  startLabel,
} from "@/features/public-deadlines/public-deadline-format";
import type {
  PublicCalculation,
  PublicRule,
} from "@/features/public-deadlines/public-deadline-types";
import type { ReviewFlag } from "@/features/deadlines/deadline-types";
import { cn } from "@/lib/utils";

/**
 * Always on screen next to the calculator (CLAUDE.md rule 6): the system assists, the lawyer
 * controls, and nothing typed here is kept.
 */
export function PublicDisclaimer({ text, className }: { text?: string; className?: string }) {
  return (
    <Alert variant="info" className={className}>
      <Info aria-hidden="true" />
      <AlertTitle>{text?.trim() || FALLBACK_DISCLAIMER}</AlertTitle>
      <AlertDescription>
        <p>
          El sistema propone la fecha; el control del plazo es tuyo, con la norma y la causa a la
          vista. No guardamos nada de lo que cargás en esta calculadora.
        </p>
      </AlertDescription>
    </Alert>
  );
}

/** "[validar]" next to a source, in the deadline color so it is not missed. */
function Tags({ flags }: { flags: ReviewFlag[] }) {
  const tags = reviewTags(flags);
  if (!tags) return null;
  return (
    <>
      {" "}
      <span className="font-bold whitespace-nowrap text-deadline">{tags}</span>
    </>
  );
}

interface Fact {
  icon: LucideIcon;
  term: string;
  value: ReactNode;
}

function Facts({ facts }: { facts: Fact[] }) {
  return (
    <dl className="grid gap-2 text-meta">
      {facts.map(({ icon: Icon, term, value }) => (
        <div key={term} className="relative min-w-0 pl-6.5">
          <Icon
            aria-hidden="true"
            className="absolute top-0.75 left-0 size-4.5 text-muted-foreground"
          />
          <dt className="inline text-muted-foreground">{term}: </dt>
          <dd className="inline text-pretty">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ruleFacts(rule: PublicRule, calculation?: PublicCalculation): Fact[] {
  const facts: Fact[] = [
    {
      icon: BookOpen,
      term: "Fuente",
      value: (
        <span className="tabular-nums">
          {rule.source}
          <Tags flags={rule.flags} />
        </span>
      ),
    },
    { icon: TriangleAlert, term: "Si vence", value: rule.consequence },
  ];
  if (calculation?.calendarSource) {
    facts.push({
      icon: CalendarDays,
      term: "Calendario judicial",
      value: (
        <>
          {calculation.calendarSource}
          <Tags flags={calculation.calendarFlags} />
        </>
      ),
    });
  }
  return facts;
}

function Note({ note }: { note: string | null }) {
  if (!note) return null;
  return (
    <p className="max-w-prose text-small text-muted-foreground">
      <span className="font-bold">Nota: </span>
      {note}
    </p>
  );
}

function DetaineeBadge() {
  return (
    <Badge variant="detained">
      <Lock aria-hidden="true" />
      Persona detenida
    </Badge>
  );
}

/** How the term was counted: where it starts, how long it runs and where it ends. */
function CountRail({
  calculation,
  due,
}: {
  calculation: PublicCalculation;
  due: { numericDay: string; time: string };
}) {
  const { rule } = calculation;
  const businessDays = rule.computation === "BUSINESS_DAYS";
  const dot = "absolute top-1.5 -left-[1.95rem] size-3 rounded-full border-2";
  return (
    <ol
      aria-label="Cómo se contó"
      className="relative ml-1.5 grid gap-4 border-l-2 border-border-strong pl-6"
    >
      <li className="relative grid gap-0.5">
        <span aria-hidden="true" className={cn(dot, "border-border-strong bg-card")} />
        <span className="text-small text-muted-foreground">Corre desde</span>
        <span className="text-body font-bold tabular-nums">{startLabel(calculation)}</span>
        <span className="text-meta text-muted-foreground">{rule.trigger}</span>
      </li>
      <li className="relative grid gap-0.5">
        <span
          aria-hidden="true"
          className={cn(dot, "-left-[1.875rem] size-2.5 border-0 bg-border-strong")}
        />
        <span className="text-meta font-semibold">
          {computationLabel(rule.computation, rule.duration)}
        </span>
        {businessDays && (
          <span className="text-small text-muted-foreground">
            Sin contar fines de semana, feriados ni ferias judiciales.
          </span>
        )}
        {rule.computation === "HOURS" && (
          <span className="text-small text-muted-foreground">
            Corren de corrido, también de noche y en días inhábiles.
          </span>
        )}
      </li>
      <li className="relative grid gap-0.5">
        <span aria-hidden="true" className={cn(dot, "border-primary bg-primary")} />
        <span className="text-small text-muted-foreground">Vence</span>
        <span className="text-body font-bold tabular-nums">
          {due.numericDay}, {due.time.replace(/^a las /, "")}
        </span>
      </li>
    </ol>
  );
}

const panel = "min-w-0 gap-5 px-4 py-5 md:px-6";

/**
 * The answer: the due date first and big (what the visitor came for), then how it was counted,
 * the article with its review tags, the court calendar used and the disclaimer.
 */
export function PublicDeadlineResult({ calculation }: { calculation: PublicCalculation }) {
  const titleId = useId();
  const { rule } = calculation;
  const due = dueParts(calculation);

  if (!due) {
    return (
      <Card asChild edge={rule.detainee ? "detained" : "none"} className={panel}>
        <section aria-labelledby={titleId}>
          <div className="grid justify-items-start gap-3">
            <CalendarX aria-hidden="true" className="size-6 text-deadline" />
            <h2 id={titleId} className="text-title font-bold text-balance">
              {notLoadedTitle(calculation.missingYear)}
            </h2>
            <p className="max-w-prose text-body text-muted-foreground">
              {rule.name} se cuenta en días hábiles y para eso hacen falta los feriados y las ferias
              judiciales de ese año. Contalo a mano con la norma, o probá con una fecha de inicio
              anterior.
            </p>
          </div>
          <Facts facts={ruleFacts(rule, calculation)} />
          <PublicDisclaimer text={calculation.disclaimer} />
        </section>
      </Card>
    );
  }

  return (
    <Card asChild edge={rule.detainee ? "detained" : "none"} className={panel}>
      <section aria-labelledby={titleId}>
        <div className="grid justify-items-start gap-1.5">
          {rule.detainee && <DetaineeBadge />}
          <h2 id={titleId} className="text-meta font-semibold text-muted-foreground">
            {rule.name}: vence el
          </h2>
          <p className="text-display font-bold text-balance tabular-nums">{due.day}</p>
          <p className="text-title font-bold tabular-nums">
            {due.time}
            {rule.computation === "HOURS" && (
              <span className="text-meta font-normal text-muted-foreground">
                {" "}
                (hora de Neuquén)
              </span>
            )}
          </p>
          {rule.computation !== "HOURS" && (
            <p className="max-w-prose text-meta text-muted-foreground">
              Los plazos en días vencen cuando termina ese día.
            </p>
          )}
        </div>

        <div className="grid gap-3 border-t pt-4">
          <h3 className="text-card-title font-bold">Cómo se contó</h3>
          <CountRail calculation={calculation} due={due} />
        </div>

        <div className="grid gap-3 border-t pt-4">
          <Facts facts={ruleFacts(rule, calculation)} />
          <Note note={rule.note} />
        </div>

        <PublicDisclaimer text={calculation.disclaimer} />
      </section>
    </Card>
  );
}

/** Before the first calculation: what the panel will show, and the disclaimer already. */
export function PublicResultPlaceholder() {
  return (
    <section
      aria-label="Resultado"
      className="grid justify-items-start gap-4 rounded-xl border border-dashed border-border-strong bg-card px-5 py-6"
    >
      <Hourglass aria-hidden="true" className="size-6 text-primary" />
      <p className="max-w-prose text-body text-muted-foreground">
        Elegí el plazo y la fecha desde la que corre, y tocá «Calculá el vencimiento». Vas a ver el
        día en que vence, cómo se contó y el artículo del CPP.
      </p>
      <PublicDisclaimer />
    </section>
  );
}

/** The chosen rule, under the select: what starts it, how it counts and what happens if it ends. */
export function RuleSummary({ rule, id }: { rule: PublicRule; id: string }) {
  return (
    <div id={id} className="grid gap-2 rounded-lg bg-muted px-3.5 py-3">
      {rule.detainee && <DetaineeBadge />}
      <dl className="grid gap-1 text-meta">
        <div>
          <dt className="inline text-muted-foreground">Desde: </dt>
          <dd className="inline">{rule.trigger}</dd>
        </div>
        <div>
          <dt className="inline text-muted-foreground">Cómo se cuenta: </dt>
          <dd className="inline">{computationLabel(rule.computation, rule.duration)}</dd>
        </div>
        <div>
          <dt className="inline text-muted-foreground">Si vence: </dt>
          <dd className="inline">{rule.consequence}</dd>
        </div>
        <div>
          <dt className="inline text-muted-foreground">Fuente: </dt>
          <dd className="inline tabular-nums">
            {rule.source}
            <Tags flags={rule.flags} />
          </dd>
        </div>
      </dl>
      <Note note={rule.note} />
    </div>
  );
}
